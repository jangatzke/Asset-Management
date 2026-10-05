-- ==========================================
-- Intune sync config: stable singleton key
-- Adds a unique `configKey` so the scheduler can upsert one canonical row
-- instead of racing findFirst -> update/create. (additive; no destructive changes)
-- ==========================================

ALTER TABLE "intune_sync_config" ADD COLUMN "configKey" TEXT NOT NULL DEFAULT 'singleton';

-- Collapse any legacy duplicate rows onto a single record before enforcing the
-- unique constraint: keep the oldest row, point the rest at the same key and
-- remove them (the application only ever reads one config row).
DELETE FROM "intune_sync_config"
WHERE "id" NOT IN (
  SELECT "id" FROM "intune_sync_config" ORDER BY "createdAt" ASC LIMIT 1
);

CREATE UNIQUE INDEX "intune_sync_config_configKey_key" ON "intune_sync_config"("configKey");
