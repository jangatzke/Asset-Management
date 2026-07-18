-- ==========================================
-- ISO 27001 Schema Phase 1 Migration
-- ==========================================

-- -----------------------------------------
-- 1. Asset model - rename rating columns (AST-004)
-- -----------------------------------------
DO $$ BEGIN ALTER TABLE "assets" DROP COLUMN "personnelSafetyRating"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "assets" ADD COLUMN "personnelSafetyRelevance" TEXT NOT NULL DEFAULT 'low';

DO $$ BEGIN UPDATE "assets" SET "regulatoryRelevance" = 'low' WHERE "regulatoryRelevance" IS NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "assets" ALTER COLUMN "regulatoryRelevance" SET NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "assets" ALTER COLUMN "regulatoryRelevance" SET DEFAULT 'low'; EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "assets" DROP COLUMN "financialDamageRating"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "assets" ADD COLUMN "financialDamagePotential" TEXT NOT NULL DEFAULT 'low';

DO $$ BEGIN ALTER TABLE "assets" DROP COLUMN "productionDowntimeRating"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "assets" ADD COLUMN "productionDowntimeImpact" TEXT NOT NULL DEFAULT 'low';

-- -----------------------------------------
-- 2. RiskMethod model changes (RSK-001/RSK-002)
-- -----------------------------------------
ALTER TABLE "risk_methods" ADD COLUMN "displayId" TEXT;
UPDATE "risk_methods" SET "displayId" = id WHERE "displayId" IS NULL;
ALTER TABLE "risk_methods" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "risk_methods" ADD CONSTRAINT "risk_methods_display_id_key" UNIQUE ("displayId");

DO $$ BEGIN ALTER TABLE "risk_methods" DROP COLUMN "evaluationDimensions"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "risk_methods" ADD COLUMN "ratingDimensions" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "risk_methods" ALTER COLUMN "ratingDimensions" DROP DEFAULT;

ALTER TABLE "risk_methods" RENAME COLUMN "calculationFormula" TO "formula";

DO $$ BEGIN ALTER TABLE "risk_methods" ALTER COLUMN "acceptanceThresholds" DROP NOT NULL; EXCEPTION WHEN invalid_column_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "risk_methods" ALTER COLUMN "escalationThresholds" DROP NOT NULL; EXCEPTION WHEN invalid_column_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "risk_methods" ALTER COLUMN "approvalRules" DROP NOT NULL; EXCEPTION WHEN invalid_column_definition THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "risk_methods" DROP COLUMN "reviewIntervals"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "risk_methods" ADD COLUMN "reviewInterval" INTEGER;

ALTER TABLE "risk_methods" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN ALTER TABLE "risk_methods" DROP COLUMN "status"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "risk_methods" DROP COLUMN "createdBy"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "risk_methods" DROP COLUMN "updatedBy"; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- -----------------------------------------
-- 3. Contract model changes (AST-002)
-- -----------------------------------------
ALTER TABLE "contracts" ADD COLUMN "displayId" TEXT;
UPDATE "contracts" SET "displayId" = id WHERE "displayId" IS NULL;
ALTER TABLE "contracts" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_display_id_key" UNIQUE ("displayId");

ALTER TABLE "contracts" RENAME COLUMN "name" TO "title";
ALTER TABLE "contracts" ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'purchase';
ALTER TABLE "contracts" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "contracts" ADD COLUMN "renewalDate" TIMESTAMP(3);
ALTER TABLE "contracts" ADD COLUMN "value" NUMERIC;
ALTER TABLE "contracts" ADD COLUMN "currency" TEXT;
ALTER TABLE "contracts" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contracts" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "contracts" ADD COLUMN "updatedBy" TEXT;

ALTER TABLE "contracts" RENAME COLUMN "startsAt" TO "startDate";
ALTER TABLE "contracts" RENAME COLUMN "endsAt" TO "endDate";

DO $$ BEGIN ALTER TABLE "contracts" DROP COLUMN "supplierName"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contracts" DROP COLUMN "contractNumber"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contracts" DROP COLUMN "notes"; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- -----------------------------------------
-- 4. License model changes (AST-002)
-- -----------------------------------------
ALTER TABLE "licenses" ADD COLUMN "displayId" TEXT;
UPDATE "licenses" SET "displayId" = id WHERE "displayId" IS NULL;
ALTER TABLE "licenses" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_display_id_key" UNIQUE ("displayId");

ALTER TABLE "licenses" RENAME COLUMN "name" TO "title";
ALTER TABLE "licenses" ADD COLUMN "licenseType" TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE "licenses" ADD COLUMN "productId" TEXT;
ALTER TABLE "licenses" ADD COLUMN "renewalDate" TIMESTAMP(3);
ALTER TABLE "licenses" ADD COLUMN "cost" NUMERIC;
ALTER TABLE "licenses" ADD COLUMN "currency" TEXT;
ALTER TABLE "licenses" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "licenses" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "licenses" ADD COLUMN "updatedBy" TEXT;

-- Rename product column (vendor already exists)
ALTER TABLE "licenses" RENAME COLUMN "product" TO "productOld";
DO $$ BEGIN ALTER TABLE "licenses" DROP COLUMN "productOld"; EXCEPTION WHEN undefined_column THEN NULL; END $$;

ALTER TABLE "licenses" RENAME COLUMN "seatsTotal" TO "seats";
DO $$ BEGIN ALTER TABLE "licenses" DROP COLUMN "seatsUsed"; EXCEPTION WHEN undefined_column THEN NULL; END $$;

ALTER TABLE "licenses" RENAME COLUMN "purchasedAt" TO "startDate";
ALTER TABLE "licenses" RENAME COLUMN "expiresAt" TO "endDate";

DO $$ BEGIN ALTER TABLE "licenses" DROP COLUMN "notes"; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- -----------------------------------------
-- 5. BusinessProcess model changes (RSK-010)
-- -----------------------------------------
ALTER TABLE "business_processes" ADD COLUMN "displayId" TEXT;
UPDATE "business_processes" SET "displayId" = id WHERE "displayId" IS NULL;
ALTER TABLE "business_processes" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "business_processes" ADD CONSTRAINT "business_processes_display_id_key" UNIQUE ("displayId");

ALTER TABLE "business_processes" RENAME COLUMN "owner" TO "processOwner";
UPDATE "business_processes" SET "processOwner" = '' WHERE "processOwner" IS NULL;
ALTER TABLE "business_processes" ALTER COLUMN "processOwner" SET NOT NULL;

ALTER TABLE "business_processes" ADD COLUMN "category" TEXT;
ALTER TABLE "business_processes" ADD COLUMN "siacControlled" BOOLEAN NOT NULL DEFAULT false;

-- Change criticality from Int to String
DO $$ BEGIN ALTER TABLE "business_processes" DROP COLUMN "criticality"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE "business_processes" ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'low';

ALTER TABLE "business_processes" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "business_processes" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "business_processes" ADD COLUMN "updatedBy" TEXT;

-- -----------------------------------------
-- 6. Drop old tables that need restructuring (order matters)
-- -----------------------------------------
DROP TABLE IF EXISTS "risk_evidence";
DROP TABLE IF EXISTS "asset_documents";

-- -----------------------------------------
-- 7. AssetDocument - convert to junction table
-- -----------------------------------------
CREATE TABLE "asset_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "asset_documents_asset_id_document_id_key" ON "asset_documents"("assetId", "documentId");

-- -----------------------------------------
-- 8. RiskEvidence - convert to junction table (Risk-Evidence)
-- -----------------------------------------
CREATE TABLE "risk_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "riskId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "risk_evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "risk_evidence_risk_id_evidence_id_key" ON "risk_evidence"("riskId", "evidenceId");

-- -----------------------------------------
-- 8. RiskAsset junction table
-- -----------------------------------------
CREATE TABLE "risk_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "riskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "risk_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "risk_assets_risk_id_asset_id_key" ON "risk_assets"("riskId", "assetId");

-- -----------------------------------------
-- 9. VulnerabilityAsset junction table
-- -----------------------------------------
CREATE TABLE "vulnerability_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vulnerabilityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "vulnerability_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vulnerability_assets_vulnerability_id_asset_id_key" ON "vulnerability_assets"("vulnerabilityId", "assetId");

-- -----------------------------------------
-- 10. IncidentAsset junction table
-- -----------------------------------------
CREATE TABLE "incident_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incidentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "incident_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "incident_assets_incident_id_asset_id_key" ON "incident_assets"("incidentId", "assetId");

-- -----------------------------------------
-- 11. AssetLifecycleLog model (AST-030)
-- -----------------------------------------
CREATE TABLE "asset_lifecycle_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "disposalEvidence" TEXT,

    CONSTRAINT "asset_lifecycle_logs_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------
-- 12. Document model (for AssetDocument junction)
-- -----------------------------------------
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT NOT NULL,
    "url" TEXT,
    "filePath" TEXT,
    "fileHash" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "documents_display_id_key" ON "documents"("displayId");

-- -----------------------------------------
-- 13. RiskTreatment model (RSK-020)
-- -----------------------------------------
CREATE TABLE "risk_treatments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "displayId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "treatmentOption" TEXT NOT NULL,
    "plannedActions" TEXT,
    "responsibleUserId" TEXT,
    "budget" NUMERIC,
    "targetDate" TIMESTAMP(3),
    "expectedReduction" TEXT,
    "dependencies" TEXT,
    "implementationStatus" TEXT NOT NULL DEFAULT 'planned',
    "effectivenessReview" TEXT,
    "completionApproval" TEXT,
    "justification" TEXT,
    "expiryDate" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_treatments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "risk_treatments_display_id_key" ON "risk_treatments"("displayId");

-- -----------------------------------------
-- 14. Drop old RiskTreatmentPlan and TreatmentAction tables
-- -----------------------------------------
DROP TABLE IF EXISTS "treatment_actions";
DROP TABLE IF EXISTS "risk_treatment_plans";
