-- Clean consolidated overhaul migration for normalized risk-control links and asset inventory.
-- Production data preservation is intentionally not required for this task.

CREATE TYPE "RiskControlRole" AS ENUM ('preventive', 'detective', 'corrective', 'recovery', 'compensating');
CREATE TYPE "RiskControlMitigationDimension" AS ENUM ('likelihood', 'impact', 'both');

ALTER TABLE "asset_types"
  ADD COLUMN IF NOT EXISTS "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "inventoryPattern" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryNextSequence" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "asset_subtypes" (
  "id" TEXT NOT NULL,
  "assetTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "inventoryEnabled" BOOLEAN,
  "inventoryPattern" TEXT,
  "inventoryNextSequence" INTEGER NOT NULL DEFAULT 1,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_subtypes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_subtypes_assetTypeId_name_key" ON "asset_subtypes"("assetTypeId", "name");
CREATE INDEX IF NOT EXISTS "asset_subtypes_assetTypeId_idx" ON "asset_subtypes"("assetTypeId");
ALTER TABLE "asset_subtypes" ADD CONSTRAINT "asset_subtypes_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "assetSubtypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "assets_inventoryNumber_key" ON "assets"("inventoryNumber");
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetSubtypeId_fkey" FOREIGN KEY ("assetSubtypeId") REFERENCES "asset_subtypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risks" DROP COLUMN IF EXISTS "existingControls";
ALTER TABLE "evidence" DROP COLUMN IF EXISTS "relatedControlIds", DROP COLUMN IF EXISTS "relatedRiskIds", DROP COLUMN IF EXISTS "relatedAssetIds", DROP COLUMN IF EXISTS "relatedSoAItemIds", DROP COLUMN IF EXISTS "relatedDocumentIds";
ALTER TABLE "soa_items" DROP COLUMN IF EXISTS "riskIds", DROP COLUMN IF EXISTS "evidenceIds", DROP COLUMN IF EXISTS "controlImplementationIds";
DROP TABLE IF EXISTS "_RiskControls";
DROP TABLE IF EXISTS "risk_evidence";

CREATE TABLE IF NOT EXISTS "risk_assessment_versions" (
  "id" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "riskMethodVersionId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "assessmentType" TEXT NOT NULL DEFAULT 'current',
  "likelihood" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "inherentRisk" TEXT NOT NULL,
  "residualRisk" TEXT NOT NULL,
  "targetRisk" TEXT NOT NULL,
  "score" INTEGER,
  "assessorId" TEXT NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextReviewDate" TIMESTAMP(3) NOT NULL,
  "justification" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_assessment_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessment_versions_riskId_versionNumber_key" ON "risk_assessment_versions"("riskId", "versionNumber");
CREATE INDEX IF NOT EXISTS "risk_assessment_versions_riskId_isCurrent_idx" ON "risk_assessment_versions"("riskId", "isCurrent");
CREATE INDEX IF NOT EXISTS "risk_assessment_versions_assessmentType_idx" ON "risk_assessment_versions"("assessmentType");
ALTER TABLE "risk_assessment_versions" ADD CONSTRAINT "risk_assessment_versions_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessment_versions" ADD CONSTRAINT "risk_assessment_versions_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "risk_controls" (
  "id" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "controlImplementationId" TEXT NOT NULL,
  "role" "RiskControlRole" NOT NULL,
  "mitigationDimension" "RiskControlMitigationDimension" NOT NULL,
  "isKeyControl" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "risk_controls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_controls_riskId_controlImplementationId_key" ON "risk_controls"("riskId", "controlImplementationId");
CREATE INDEX IF NOT EXISTS "risk_controls_riskId_idx" ON "risk_controls"("riskId");
CREATE INDEX IF NOT EXISTS "risk_controls_controlImplementationId_idx" ON "risk_controls"("controlImplementationId");
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_controlImplementationId_fkey" FOREIGN KEY ("controlImplementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "risk_control_assessments" (
  "id" TEXT NOT NULL,
  "riskControlId" TEXT NOT NULL,
  "riskAssessmentVersionId" TEXT NOT NULL,
  "effectivenessStatus" TEXT NOT NULL,
  "effectivenessRating" INTEGER,
  "likelihoodReduction" INTEGER,
  "impactReduction" INTEGER,
  "justification" TEXT NOT NULL,
  "assessedBy" TEXT NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "risk_control_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_control_assessments_riskControlId_riskAssessmentVersionId_key" ON "risk_control_assessments"("riskControlId", "riskAssessmentVersionId");
CREATE INDEX IF NOT EXISTS "risk_control_assessments_riskAssessmentVersionId_idx" ON "risk_control_assessments"("riskAssessmentVersionId");
ALTER TABLE "risk_control_assessments" ADD CONSTRAINT "risk_control_assessments_riskControlId_fkey" FOREIGN KEY ("riskControlId") REFERENCES "risk_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_control_assessments" ADD CONSTRAINT "risk_control_assessments_riskAssessmentVersionId_fkey" FOREIGN KEY ("riskAssessmentVersionId") REFERENCES "risk_assessment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "treatment_actions" (
  "id" TEXT NOT NULL,
  "treatmentId" TEXT NOT NULL,
  "controlImplementationId" TEXT,
  "actionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "responsibleUserId" TEXT,
  "targetDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'planned',
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "treatment_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "treatment_actions_treatmentId_idx" ON "treatment_actions"("treatmentId");
CREATE INDEX IF NOT EXISTS "treatment_actions_controlImplementationId_idx" ON "treatment_actions"("controlImplementationId");
ALTER TABLE "treatment_actions" ADD CONSTRAINT "treatment_actions_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "treatment_actions" ADD CONSTRAINT "treatment_actions_controlImplementationId_fkey" FOREIGN KEY ("controlImplementationId") REFERENCES "control_implementations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "control_tests" (
  "id" TEXT NOT NULL,
  "controlImplementationId" TEXT NOT NULL,
  "testType" TEXT NOT NULL,
  "testMethod" TEXT,
  "testedBy" TEXT NOT NULL,
  "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "result" TEXT NOT NULL,
  "effectivenessRating" INTEGER,
  "findings" TEXT,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "nextTestDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "control_tests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "control_tests_controlImplementationId_idx" ON "control_tests"("controlImplementationId");
ALTER TABLE "control_tests" ADD CONSTRAINT "control_tests_controlImplementationId_fkey" FOREIGN KEY ("controlImplementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "soa_item_control_implementations" (
  "id" TEXT NOT NULL,
  "soaItemId" TEXT NOT NULL,
  "controlImplementationId" TEXT NOT NULL,
  CONSTRAINT "soa_item_control_implementations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "soa_item_control_implementations_soaItemId_controlImplementationId_key" ON "soa_item_control_implementations"("soaItemId", "controlImplementationId");
CREATE INDEX IF NOT EXISTS "soa_item_control_implementations_controlImplementationId_idx" ON "soa_item_control_implementations"("controlImplementationId");
ALTER TABLE "soa_item_control_implementations" ADD CONSTRAINT "soa_item_control_implementations_soaItemId_fkey" FOREIGN KEY ("soaItemId") REFERENCES "soa_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evidence_links" ADD COLUMN IF NOT EXISTS "riskControlAssessmentId" TEXT;
ALTER TABLE "evidence_links" ADD COLUMN IF NOT EXISTS "controlTestId" TEXT;
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_riskControlAssessmentId_fkey" FOREIGN KEY ("riskControlAssessmentId") REFERENCES "risk_control_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_controlTestId_fkey" FOREIGN KEY ("controlTestId") REFERENCES "control_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
