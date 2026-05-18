-- Przyczyna: polityki adminów robiły SELECT na user_profiles wewnątrz RLS user_profiles.
-- Rozwiązanie: funkcja is_admin() SECURITY DEFINER omija rekurencję.

-- ── 1. Funkcja pomocnicza (bez rekurencji RLS) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ── 2. user_profiles — usuń rekurencyjne polityki adminów ─────────────────

DROP POLICY IF EXISTS "admins select all profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins update any profile" ON user_profiles;
DROP POLICY IF EXISTS "admins delete profiles" ON user_profiles;

CREATE POLICY "admins select all profiles"
  ON user_profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admins update any profile"
  ON user_profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "admins delete profiles"
  ON user_profiles FOR DELETE
  USING (public.is_admin());

-- ── 3. app_config — ta sama poprawka ──────────────────────────────────────

DROP POLICY IF EXISTS "admins write config" ON app_config;

CREATE POLICY "admins write config"
  ON app_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. Trigger guard_role_change (używa is_admin) ─────────────────────────

CREATE OR REPLACE FUNCTION guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = OLD.role THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_role_change_trigger ON user_profiles;

CREATE TRIGGER guard_role_change_trigger
  BEFORE UPDATE OF role
  ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_role_change();
