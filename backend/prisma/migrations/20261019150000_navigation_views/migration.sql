-- Navigation views: saved show/hide + order configurations (global and per-user).
-- All statements are written idempotently so the migration can be re-applied
-- safely against databases that were partially aligned via `prisma db push`.

-- AlterTable: global default view gains hidden entries
ALTER TABLE "navigation_config" ADD COLUMN IF NOT EXISTS "hiddenEntries" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: saved navigation views (ownerId NULL = global view)
CREATE TABLE IF NOT EXISTS "navigation_views" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "navOrder" JSONB NOT NULL DEFAULT '[]',
    "hiddenEntries" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_views_pkey" PRIMARY KEY ("id")
);

-- AlterTable: pointer to the navigation view currently active for a user
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeNavigationViewId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "navigation_views_ownerId_idx" ON "navigation_views"("ownerId");

CREATE INDEX IF NOT EXISTS "users_activeNavigationViewId_idx" ON "users"("activeNavigationViewId");

-- AddForeignKey: view owner (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'navigation_views_ownerId_fkey'
  ) THEN
    ALTER TABLE "navigation_views" ADD CONSTRAINT "navigation_views_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: active view pointer (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_activeNavigationViewId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_activeNavigationViewId_fkey"
      FOREIGN KEY ("activeNavigationViewId") REFERENCES "navigation_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
