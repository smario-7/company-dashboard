# Supabase migrations (Etap 6)

1. Open Supabase Dashboard → SQL Editor.
2. Run [`migrations/001_trello_and_notifications.sql`](migrations/001_trello_and_notifications.sql).
3. If Realtime on `notifications` fails (already added), ignore that line.
4. Migrate existing GitHub JSON: `npm run db:migrate-github` (needs `SUPABASE_SERVICE_ROLE_KEY` and `GITHUB_TOKEN` in `.env`).
