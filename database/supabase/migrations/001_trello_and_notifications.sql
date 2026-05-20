-- Etap 6: Trello w Supabase, powiadomienia, komentarze, activity log
-- Vault dokumentów pozostaje na GitHub (projects/.../cards/{id}/*.md|canvas)

-- ── Projects ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id           text PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  color        text NOT NULL DEFAULT '#3b82f6',
  emoji        text NOT NULL DEFAULT '📁',
  archived     boolean NOT NULL DEFAULT false,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_archived_idx ON public.projects (archived);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON public.projects (created_at DESC);

-- ── Boards ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.boards (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  slug         text NOT NULL,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  columns      jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_order   jsonb NOT NULL DEFAULT '{}'::jsonb,
  labels       jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived     boolean NOT NULL DEFAULT false,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS boards_project_id_idx ON public.boards (project_id);

-- ── Cards ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cards (
  id                    text PRIMARY KEY,
  board_id              text NOT NULL REFERENCES public.boards (id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  label_ids             text[] NOT NULL DEFAULT '{}',
  assignees             text[] NOT NULL DEFAULT '{}',
  due_date              date,
  priority              text NOT NULL DEFAULT 'none'
    CHECK (priority IN ('none', 'low', 'medium', 'high')),
  checklist             jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived              boolean NOT NULL DEFAULT false,
  created_by            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  last_due_reminder_at  date
);

CREATE INDEX IF NOT EXISTS cards_board_id_idx ON public.cards (board_id);
CREATE INDEX IF NOT EXISTS cards_board_archived_idx ON public.cards (board_id, archived);
CREATE INDEX IF NOT EXISTS cards_assignees_gin ON public.cards USING gin (assignees);
CREATE INDEX IF NOT EXISTS cards_due_date_idx ON public.cards (due_date) WHERE due_date IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.card_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     text NOT NULL REFERENCES public.cards (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  body        text NOT NULL,
  mentions    text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS card_comments_card_id_idx ON public.card_comments (card_id, created_at);

-- ── Activity log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    text NOT NULL REFERENCES public.boards (id) ON DELETE CASCADE,
  card_id     text REFERENCES public.cards (id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  action      text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_card_idx ON public.activity_log (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_board_idx ON public.activity_log (board_id, created_at DESC);

-- ── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  type        text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  actor_id    uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON public.notifications (user_id, read, created_at DESC);

-- ── Notification prefs (create if missing) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  on_card_assign  boolean NOT NULL DEFAULT true,
  on_comment      boolean NOT NULL DEFAULT true,
  on_due_date     boolean NOT NULL DEFAULT true,
  on_card_move    boolean NOT NULL DEFAULT false,
  on_mention      boolean NOT NULL DEFAULT true
);

-- ── Helpers ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS boards_updated_at ON public.boards;
CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS cards_updated_at ON public.cards;
CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_notification_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_prefs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_notification_prefs_trigger ON public.user_profiles;
CREATE TRIGGER ensure_notification_prefs_trigger
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_prefs();

-- Map notification type → pref column
CREATE OR REPLACE FUNCTION public.should_notify(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  prefs public.notification_prefs%ROWTYPE;
BEGIN
  SELECT * INTO prefs FROM public.notification_prefs WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN CASE p_type
    WHEN 'card_assigned' THEN prefs.on_card_assign
    WHEN 'comment_added' THEN prefs.on_comment
    WHEN 'mentioned' THEN prefs.on_mention
    WHEN 'due_date_reminder' THEN prefs.on_due_date
    WHEN 'card_moved' THEN prefs.on_card_move
    ELSE true
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.should_notify(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_actor_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_recipient_id = p_actor_id THEN
    RETURN NULL;
  END IF;

  IF NOT public.should_notify(p_recipient_id, p_type) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, actor_id, payload)
  VALUES (p_recipient_id, p_type, p_actor_id, p_payload)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, uuid, jsonb) TO authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- Authenticated workspace members (repo access verified at login)
DROP POLICY IF EXISTS "auth crud projects" ON public.projects;
CREATE POLICY "auth crud projects" ON public.projects
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth crud boards" ON public.boards;
CREATE POLICY "auth crud boards" ON public.boards
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth crud cards" ON public.cards;
CREATE POLICY "auth crud cards" ON public.cards
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth read comments" ON public.card_comments;
CREATE POLICY "auth read comments" ON public.card_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert comments" ON public.card_comments;
CREATE POLICY "auth insert comments" ON public.card_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth update own comments" ON public.card_comments;
CREATE POLICY "auth update own comments" ON public.card_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "auth delete own comments" ON public.card_comments;
CREATE POLICY "auth delete own comments" ON public.card_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "auth read activity" ON public.activity_log;
CREATE POLICY "auth read activity" ON public.activity_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert activity" ON public.activity_log;
CREATE POLICY "auth insert activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prefs select own" ON public.notification_prefs;
CREATE POLICY "prefs select own" ON public.notification_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prefs upsert own" ON public.notification_prefs;
CREATE POLICY "prefs upsert own" ON public.notification_prefs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
