-- Repair displayId values on databases where the original migration was
-- already applied. This migration deliberately remains separate so its
-- predecessor retains the checksum recorded in _prisma_migrations.
--
-- The backfill continues after the highest numeric CAPA suffix, avoiding
-- collisions with legacy CAPA-0001, CAPA-0002, ... values.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'corrective_actions'
      AND column_name = 'displayId'
  ) THEN
    ALTER TABLE "corrective_actions" ADD COLUMN "displayId" TEXT;
  END IF;
END $$;

DO $$
DECLARE
  max_existing BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'corrective_actions'
      AND column_name = 'displayId'
  ) THEN
    SELECT COALESCE(MAX(assigned), 0) INTO max_existing
    FROM (
      SELECT CAST(regexp_replace("displayId", '^CAPA-(\d+)$', '\1') AS BIGINT) AS assigned
      FROM "corrective_actions"
      WHERE "displayId" ~ '^CAPA-\d+$'
    ) AS existing;

    UPDATE "corrective_actions"
    SET "displayId" = replacements.display_id
    FROM (
      SELECT
        "id",
        'CAPA-' || LPAD((max_existing + row_number() OVER (ORDER BY "id"))::text, 4, '0') AS display_id
      FROM "corrective_actions"
      WHERE "displayId" IS NULL OR "displayId" = ''
    ) AS replacements
    WHERE "corrective_actions"."id" = replacements."id";
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "corrective_actions" ALTER COLUMN "displayId" SET NOT NULL;
EXCEPTION
  WHEN undefined_table OR undefined_column OR invalid_column_definition THEN
    NULL;
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "corrective_actions_displayId_key"
    ON "corrective_actions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;
