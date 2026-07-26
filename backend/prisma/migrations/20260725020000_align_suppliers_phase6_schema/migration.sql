-- Align existing local databases with the Phase 6 Supplier Prisma model.
-- Some databases were initialized from the consolidated baseline where
-- suppliers had an older column set, then only displayId was backfilled later.
-- Prisma selects all model columns during supplier.findMany(), so any missing
-- Supplier column (for example description) causes /isms-phase6 to fail with a
-- runtime P2022 error.

DO $$
BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "servicesProvided" TEXT;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "dataProtectionRelevant" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "nis2Relevant" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "exitStrategy" TEXT;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "assessmentScore" INTEGER;
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "assessmentRating" TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'productsAndServices'
    ) THEN
      UPDATE "suppliers"
      SET "servicesProvided" = COALESCE("servicesProvided", "productsAndServices")
      WHERE "servicesProvided" IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'exitRules'
    ) THEN
      UPDATE "suppliers"
      SET "exitStrategy" = COALESCE("exitStrategy", "exitRules")
      WHERE "exitStrategy" IS NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'securityRequirements'
    ) THEN
      ALTER TABLE "suppliers" ADD COLUMN "securityRequirements" JSONB NOT NULL DEFAULT '{}';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'securityRequirements'
        AND data_type <> 'jsonb'
    ) THEN
      ALTER TABLE "suppliers"
      ALTER COLUMN "securityRequirements" DROP NOT NULL,
      ALTER COLUMN "securityRequirements" DROP DEFAULT;

      ALTER TABLE "suppliers"
      ALTER COLUMN "securityRequirements" TYPE JSONB
      USING CASE
        WHEN "securityRequirements" IS NULL OR btrim("securityRequirements"::text) = '' THEN '{}'::jsonb
        ELSE to_jsonb("securityRequirements"::text)
      END;

      UPDATE "suppliers"
      SET "securityRequirements" = '{}'::jsonb
      WHERE "securityRequirements" IS NULL;

      ALTER TABLE "suppliers"
      ALTER COLUMN "securityRequirements" SET DEFAULT '{}',
      ALTER COLUMN "securityRequirements" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'certifications'
    ) THEN
      ALTER TABLE "suppliers" ADD COLUMN "certifications" JSONB NOT NULL DEFAULT '[]';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers'
        AND column_name = 'certifications'
        AND data_type <> 'jsonb'
    ) THEN
      ALTER TABLE "suppliers"
      ALTER COLUMN "certifications" DROP NOT NULL,
      ALTER COLUMN "certifications" DROP DEFAULT;

      ALTER TABLE "suppliers"
      ALTER COLUMN "certifications" TYPE JSONB
      USING COALESCE(to_jsonb("certifications"), '[]'::jsonb);

      UPDATE "suppliers"
      SET "certifications" = '[]'::jsonb
      WHERE "certifications" IS NULL;

      ALTER TABLE "suppliers"
      ALTER COLUMN "certifications" SET DEFAULT '[]',
      ALTER COLUMN "certifications" SET NOT NULL;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_displayId_key" ON "suppliers"("displayId");
    CREATE INDEX IF NOT EXISTS "suppliers_criticality_idx" ON "suppliers"("criticality");
    CREATE INDEX IF NOT EXISTS "suppliers_nextReviewDate_idx" ON "suppliers"("nextReviewDate");
  END IF;
END $$;
