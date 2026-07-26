-- Runtime schema alignment for databases that were initialized from the
-- consolidated baseline but did not receive later additive columns.
-- PostgreSQL folds unquoted information_schema.column_name comparisons to the
-- exact stored mixed-case column names, so use ALTER ... IF NOT EXISTS directly.

-- Add missing columns to assets table
DO $$ 
BEGIN
  ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "complianceRelevance" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
  ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "disposalDate" TIMESTAMP(3);
  ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "disposalMethod" TEXT;
  ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "disposalResponsible" TEXT;
END $$;

-- Add missing columns to risks table
DO $$ 
BEGIN
  ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "riskMethodVersionId" TEXT;
  ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "scenarioId" TEXT;
END $$;

CREATE INDEX IF NOT EXISTS "risks_riskMethodVersionId_idx" ON "risks"("riskMethodVersionId");
CREATE INDEX IF NOT EXISTS "risks_scenarioId_idx" ON "risks"("scenarioId");

DO $$
BEGIN
  IF to_regclass('public.risk_method_versions') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_riskMethodVersionId_fkey') THEN
    ALTER TABLE "risks"
      ADD CONSTRAINT "risks_riskMethodVersionId_fkey"
      FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.risk_scenarios') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_scenarioId_fkey') THEN
    ALTER TABLE "risks"
      ADD CONSTRAINT "risks_scenarioId_fkey"
      FOREIGN KEY ("scenarioId") REFERENCES "risk_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing displayId column to suppliers table
DO $$ 
BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "displayId" TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_displayId_key" ON "suppliers"("displayId");
  END IF;
END $$;

-- Add missing Phase 5 incident workflow columns/tables for databases that were
-- initialized from the consolidated baseline but skipped the additive workflow migration.
DO $$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL THEN
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "significanceRuleVersionId" TEXT;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "isSignificant" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "significanceReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "rootCause" TEXT;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "lessonsLearned" TEXT;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "measuresEvaluation" TEXT;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "closureSummary" TEXT;
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
    ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "closedBy" TEXT;
  END IF;

  IF to_regclass('public.incident_assessments') IS NOT NULL THEN
    ALTER TABLE "incident_assessments" ADD COLUMN IF NOT EXISTS "decisionApprovedAt" TIMESTAMP(3);
    ALTER TABLE "incident_assessments" ADD COLUMN IF NOT EXISTS "significanceRuleVersionId" TEXT;
    ALTER TABLE "incident_assessments" ADD COLUMN IF NOT EXISTS "evaluatedRules" JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "nis2_incident_significance_rule_versions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "nis2_incident_significance_rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nis2_incident_significance_rule_versions_version_key" ON "nis2_incident_significance_rule_versions"("version");
CREATE INDEX IF NOT EXISTS "incidents_significanceRuleVersionId_idx" ON "incidents"("significanceRuleVersionId");
CREATE INDEX IF NOT EXISTS "incident_assessments_significanceRuleVersionId_idx" ON "incident_assessments"("significanceRuleVersionId");

DO $$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_significanceRuleVersionId_fkey') THEN
    ALTER TABLE "incidents"
      ADD CONSTRAINT "incidents_significanceRuleVersionId_fkey"
      FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.incident_assessments') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assessments_significanceRuleVersionId_fkey') THEN
    ALTER TABLE "incident_assessments"
      ADD CONSTRAINT "incident_assessments_significanceRuleVersionId_fkey"
      FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
