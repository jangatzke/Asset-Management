-- Owner/responsible fields as real User relations (F-01/F-14 referential integrity)
--
-- Columns already exist from the consolidated baseline:
--   assets.technicalOperatorId / businessOwnerId / informationSecurityResponsibleId (nullable)
--   risks.riskOwnerId / assessorId (NOT NULL)
--
-- This migration:
--   1. Repairs data quality BEFORE constraints are added:
--      - assets: orphaned owner/operator/responsible IDs are cleared (matches SetNull semantics)
--      - risks : orphaned riskOwnerId/assessorId are reassigned to an active admin user
--                (the risk cannot be null); if no active admin exists the migration fails
--                with an explicit report instead of silently corrupting data
--   2. Adds the foreign keys (assets: ON DELETE SET NULL, risks: ON DELETE RESTRICT)
--   3. Adds the hot-path indexes used by scoped authorization filters

-- ---------------------------------------------------------------------------
-- Step 1: Data quality remediation (must run before the FK constraints)
-- ---------------------------------------------------------------------------

-- Assets: clear owner fields pointing at non-existent or inactive users (SetNull semantics)
UPDATE "assets"
SET "technicalOperatorId" = NULL
WHERE "technicalOperatorId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = "assets"."technicalOperatorId" AND u."isActive" = TRUE
  );

UPDATE "assets"
SET "businessOwnerId" = NULL
WHERE "businessOwnerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = "assets"."businessOwnerId" AND u."isActive" = TRUE
  );

UPDATE "assets"
SET "informationSecurityResponsibleId" = NULL
WHERE "informationSecurityResponsibleId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = "assets"."informationSecurityResponsibleId" AND u."isActive" = TRUE
  );

-- Risks: riskOwnerId/assessorId are NOT NULL, so orphans must be reassigned.
-- Fallback: first active system-admin user (by ascending email for determinism).
DO $$
DECLARE
  fallback_user TEXT;
  orphan_count  INTEGER;
BEGIN
  SELECT u."id" INTO fallback_user
  FROM "users" u
  JOIN "user_roles" ur ON ur."userId" = u."id"
  JOIN "roles" ro ON ro."id" = ur."roleId"
  WHERE u."isActive" = TRUE AND ro."name" = 'system_admin'
  ORDER BY u."email" ASC
  LIMIT 1;

  IF fallback_user IS NULL THEN
    SELECT COALESCE(SUM(
             CASE WHEN NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."riskOwnerId" AND u."isActive" = TRUE) THEN 1 ELSE 0 END
             +
             CASE WHEN NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."assessorId" AND u."isActive" = TRUE) THEN 1 ELSE 0 END
           ), 0)
    INTO orphan_count
    FROM "risks" r;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Cannot add risks FK constraints: % orphaned riskOwnerId/assessorId references and no active system_admin user available as fallback', orphan_count
        USING HINT = 'Assign an active system_admin user, then re-run this migration.';
    END IF;
    RETURN; -- no orphans, nothing to reassign
  END IF;

  UPDATE "risks" r
  SET "riskOwnerId" = fallback_user
  WHERE NOT EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = r."riskOwnerId" AND u."isActive" = TRUE
  );

  UPDATE "risks" r
  SET "assessorId" = fallback_user
  WHERE NOT EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = r."assessorId" AND u."isActive" = TRUE
  );
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: Foreign key constraints (guarded for re-runnability)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_technical_operator'
  ) THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "fk_assets_technical_operator"
      FOREIGN KEY ("technicalOperatorId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_business_owner'
  ) THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "fk_assets_business_owner"
      FOREIGN KEY ("businessOwnerId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_security_responsible'
  ) THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "fk_assets_security_responsible"
      FOREIGN KEY ("informationSecurityResponsibleId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_risks_risk_owner'
  ) THEN
    ALTER TABLE "risks"
      ADD CONSTRAINT "fk_risks_risk_owner"
      FOREIGN KEY ("riskOwnerId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_risks_assessor'
  ) THEN
    ALTER TABLE "risks"
      ADD CONSTRAINT "fk_risks_assessor"
      FOREIGN KEY ("assessorId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: Hot-path indexes (filter by owner fields; authorization scope joins)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "assets_technicaloperatorid_idx"
  ON "assets" ("technicalOperatorId");
CREATE INDEX IF NOT EXISTS "assets_businessownerid_idx"
  ON "assets" ("businessOwnerId");
CREATE INDEX IF NOT EXISTS "assets_informationsecurityresponsibleid_idx"
  ON "assets" ("informationSecurityResponsibleId");
CREATE INDEX IF NOT EXISTS "risks_riskownerid_idx"
  ON "risks" ("riskOwnerId");
CREATE INDEX IF NOT EXISTS "risks_assessorid_idx"
  ON "risks" ("assessorId");
