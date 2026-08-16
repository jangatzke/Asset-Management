-- Repair migration: add, backfill, and enforce corrective_actions.displayId.
--
-- Problem: deployed databases created before phase6 lack the displayId column
-- on corrective_actions, yet Prisma schema declares `displayId String @unique`
-- (NOT NULL + unique), causing runtime Prisma query failures in /action-center.
--
-- This migration is forward-only and idempotent — safe to run repeatedly and
-- does not modify any previously-applied migration history.
--
-- Steps:
--   1. Add displayId TEXT column if missing (nullable to allow backfill).
--   2. Backfill legacy rows with unique CAPA-XXXX values, starting after the
--      highest existing numeric CAPA suffix (collision-safe on partially
--      migrated databases).
--   3. Set NOT NULL constraint once all rows have values.
--   4. Add unique index if not already present.

-- Step 1: Add the column if it does not exist.
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

-- Step 2: Backfill NULL displayId values with unique CAPA-XXXX identifiers.
-- Collision-safe: numbering starts after the highest existing numeric CAPA
-- suffix (so a database that already contains CAPA-0001 / CAPA-0002 never
-- receives duplicate CAPA-0001 / CAPA-0002), and new rows are numbered
-- deterministically with row_number() OVER (ORDER BY "id").
-- Only values matching ^CAPA-\d+$ are considered when computing the max, so
-- non-numeric displayIds (e.g. CAPA-EXISTING) cannot break the CAST.
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
    SET "displayId" = sub.new_display_id
    FROM (
      SELECT
        "id",
        'CAPA-' || LPAD((max_existing + row_number() OVER (ORDER BY "id"))::text, 4, '0') AS new_display_id
      FROM "corrective_actions"
      WHERE "displayId" IS NULL OR "displayId" = ''
    ) AS sub
    WHERE "corrective_actions"."id" = sub."id";
  END IF;
END $$;

-- Step 3: Enforce NOT NULL — fails safely if constraint already exists.
DO $$
BEGIN
  ALTER TABLE "corrective_actions" ALTER COLUMN "displayId" SET NOT NULL;
EXCEPTION
  WHEN undefined_column THEN
    NULL;
  WHEN invalid_column_definition THEN
    -- Constraint may already exist; safe to ignore.
    NULL;
END $$;

-- Step 4: Add the unique index if not already present.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "corrective_actions_displayId_key"
    ON "corrective_actions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;
