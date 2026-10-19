-- Two-layer navigation ordering: global default (admin) + per-user override.
-- navigation_config is an admin-configurable singleton; users.navigationOrder
-- stores a per-user override as a JSON array of known navigation hrefs.
CREATE TABLE IF NOT EXISTS "navigation_config" (
    "id"        TEXT PRIMARY KEY,
    "navOrder"  JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "navigationOrder" JSONB;
