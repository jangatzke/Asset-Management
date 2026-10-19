-- Per-user hidden top-navigation entries (personal override of the global hidden list).
-- Idempotent so it can be re-applied safely on already-migrated databases.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hiddenNavigationEntries" JSONB;
