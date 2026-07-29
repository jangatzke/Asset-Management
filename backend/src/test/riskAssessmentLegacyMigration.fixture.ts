import { randomUUID } from 'crypto';

export interface LegacyRiskAssessmentFixture {
  sql: string;
  legacyCurrentAssessmentId: string;
  legacyHistoricalAssessmentId: string;
  riskId: string;
  riskMethodVersionId: string;
  treatmentId: string;
  acceptanceId: string;
}

const literal = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const iso = (value: string): string => `${literal(value)}::timestamptz`;

const json = (value: string): string => `${literal(value)}::jsonb`;

/**
 * Builds a deterministic, disposable pre-migration fixture with the old
 * risk_assessments table shape and legacy rows plus dependent treatment and
 * acceptance references.
 */
export function buildLegacyRiskAssessmentFixture(): LegacyRiskAssessmentFixture {
  const suffix = randomUUID();
  const riskMethodId = `legacy-risk-method-${suffix}`;
  const riskMethodVersionId = `legacy-method-version-${suffix}`;
  const riskId = `legacy-risk-${suffix}`;
  const currentAssessmentId = `legacy-assessment-current-${suffix}`;
  const historicalAssessmentId = `legacy-assessment-historical-${suffix}`;
  const treatmentId = `legacy-treatment-${suffix}`;
  const acceptanceId = `legacy-acceptance-${suffix}`;

  const sql = `
    CREATE TABLE IF NOT EXISTS "risk_methods" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "displayId" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "version" TEXT NOT NULL,
      "likelihoodScale" JSONB NOT NULL,
      "impactScale" JSONB NOT NULL,
      "ratingDimensions" JSONB NOT NULL,
      "calculationType" TEXT NOT NULL DEFAULT 'product',
      "formulaExpression" TEXT,
      "riskClasses" JSONB NOT NULL,
      "acceptanceThresholds" JSONB,
      "escalationThresholds" JSONB,
      "approvalRules" JSONB,
      "reviewInterval" INTEGER,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "risk_method_versions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "riskMethodId" TEXT NOT NULL,
      "versionTag" TEXT NOT NULL,
      "likelihoodScale" JSONB NOT NULL,
      "impactScale" JSONB NOT NULL,
      "ratingDimensions" JSONB NOT NULL,
      "calculationType" TEXT NOT NULL DEFAULT 'product',
      "formulaExpression" TEXT,
      "riskClasses" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isImmutable" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "risk_method_versions_riskMethodId_fkey" FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "risks" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "displayId" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "possibleImpact" TEXT NOT NULL,
      "likelihood" INTEGER NOT NULL,
      "impact" INTEGER NOT NULL,
      "inherentRisk" TEXT NOT NULL,
      "residualRisk" TEXT NOT NULL,
      "targetRisk" TEXT NOT NULL,
      "riskOwnerId" TEXT NOT NULL,
      "assessorId" TEXT NOT NULL,
      "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "nextReviewDate" TIMESTAMP(3) NOT NULL,
      "evaluationJustification" TEXT,
      "status" TEXT NOT NULL DEFAULT 'identified',
      "version" TEXT NOT NULL DEFAULT '1.0.0',
      "riskMethodVersionId" TEXT,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS "risk_assessment_versions" (
      "id" TEXT NOT NULL PRIMARY KEY,
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
      CONSTRAINT "risk_assessment_versions_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE,
      CONSTRAINT "risk_assessment_versions_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessment_versions_riskId_versionNumber_key" ON "risk_assessment_versions"("riskId", "versionNumber");

    CREATE TABLE IF NOT EXISTS "risk_assessments" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "riskId" TEXT NOT NULL,
      "riskMethodVersionId" TEXT NOT NULL,
      "assessmentNumber" INTEGER NOT NULL DEFAULT 1,
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
      "isCurrent" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "risk_assessments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE,
      CONSTRAINT "risk_assessments_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessments_riskId_assessmentNumber_key" ON "risk_assessments"("riskId", "assessmentNumber");

    CREATE TABLE IF NOT EXISTS "risk_treatments" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "displayId" TEXT NOT NULL UNIQUE,
      "riskId" TEXT NOT NULL,
      "assessmentId" TEXT,
      "treatmentOption" TEXT NOT NULL,
      "plannedActions" TEXT,
      "implementationStatus" TEXT NOT NULL DEFAULT 'planned',
      "justification" TEXT,
      "expiryDate" TIMESTAMP(3),
      "residualAssessmentId" TEXT,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "risk_treatments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "risk_acceptances" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "treatmentId" TEXT NOT NULL UNIQUE,
      "riskId" TEXT NOT NULL,
      "assessmentId" TEXT NOT NULL,
      "justification" TEXT NOT NULL,
      "expiryDate" TIMESTAMP(3) NOT NULL,
      "requestedBy" TEXT NOT NULL,
      "requiredLevel" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectionReason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "risk_acceptances_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE,
      CONSTRAINT "risk_acceptances_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT
    );

    INSERT INTO "risk_methods" ("id", "displayId", "name", "version", "likelihoodScale", "impactScale", "ratingDimensions", "calculationType", "riskClasses", "updatedAt")
    VALUES (${literal(riskMethodId)}, 'RM-LEGACY-001', 'Legacy fixture method', '1.0.0', ${json('{"1":"low","5":"high"}')}, ${json('{"1":"low","5":"high"}')}, ${json('{"dimensions":["confidentiality","integrity","availability"]}')}, 'product', ${json('{"low":{"max":4},"high":{"min":15}}')}, ${iso('2026-01-01T00:00:00.000Z')});

    INSERT INTO "risk_method_versions" ("id", "riskMethodId", "versionTag", "likelihoodScale", "impactScale", "ratingDimensions", "calculationType", "riskClasses", "createdAt", "isImmutable")
    VALUES (${literal(riskMethodVersionId)}, ${literal(riskMethodId)}, '1.0.0-snapshot-legacy', ${json('{"1":"low","5":"high"}')}, ${json('{"1":"low","5":"high"}')}, ${json('{"dimensions":["confidentiality","integrity","availability"]}')}, 'product', ${json('{"low":{"max":4},"high":{"min":15}}')}, ${iso('2026-01-02T00:00:00.000Z')}, true);

    INSERT INTO "risks" ("id", "displayId", "title", "description", "possibleImpact", "likelihood", "impact", "inherentRisk", "residualRisk", "targetRisk", "riskOwnerId", "assessorId", "assessmentDate", "nextReviewDate", "evaluationJustification", "riskMethodVersionId", "updatedAt")
    VALUES (${literal(riskId)}, 'RSK-LEGACY-001', 'Legacy migration fixture risk', 'Risk used only for legacy migration verification', 'Service outage and data exposure', 4, 5, 'critical', 'medium', 'low', 'owner-legacy', 'assessor-legacy', ${iso('2026-02-01T09:00:00.000Z')}, ${iso('2026-08-01T09:00:00.000Z')}, 'Legacy risk values should remain related to migrated assessments', ${literal(riskMethodVersionId)}, ${iso('2026-02-01T09:00:00.000Z')});

    INSERT INTO "risk_assessments" ("id", "riskId", "riskMethodVersionId", "assessmentNumber", "assessmentType", "likelihood", "impact", "inherentRisk", "residualRisk", "targetRisk", "score", "assessorId", "assessedAt", "nextReviewDate", "justification", "isCurrent", "createdAt")
    VALUES
      (${literal(historicalAssessmentId)}, ${literal(riskId)}, ${literal(riskMethodVersionId)}, 1, 'current', 2, 3, 'medium', 'low', 'low', 6, 'assessor-historical', ${iso('2026-02-15T10:00:00.000Z')}, ${iso('2026-08-15T10:00:00.000Z')}, 'Historical legacy justification', false, ${iso('2026-02-15T10:00:00.000Z')}),
      (${literal(currentAssessmentId)}, ${literal(riskId)}, ${literal(riskMethodVersionId)}, 2, 'current', 4, 5, 'critical', 'medium', 'low', 20, 'assessor-current', ${iso('2026-03-20T11:30:00.000Z')}, ${iso('2026-09-20T11:30:00.000Z')}, 'Current legacy justification with stable values', true, ${iso('2026-03-20T11:30:00.000Z')});

    INSERT INTO "risk_treatments" ("id", "displayId", "riskId", "assessmentId", "treatmentOption", "plannedActions", "implementationStatus", "justification", "expiryDate", "residualAssessmentId", "updatedAt")
    VALUES (${literal(treatmentId)}, 'RT-LEGACY-001', ${literal(riskId)}, ${literal(historicalAssessmentId)}, 'accept', 'Document acceptance and monitor controls', 'planned', 'Treatment references legacy assessment ids before migration', ${iso('2026-12-31T00:00:00.000Z')}, ${literal(currentAssessmentId)}, ${iso('2026-04-01T00:00:00.000Z')});

    INSERT INTO "risk_acceptances" ("id", "treatmentId", "riskId", "assessmentId", "justification", "expiryDate", "requestedBy", "requiredLevel", "status", "createdAt", "updatedAt")
    VALUES (${literal(acceptanceId)}, ${literal(treatmentId)}, ${literal(riskId)}, ${literal(currentAssessmentId)}, 'Acceptance points at legacy current assessment before migration', ${iso('2026-12-31T00:00:00.000Z')}, 'owner-legacy', 'management', 'pending', ${iso('2026-04-02T00:00:00.000Z')}, ${iso('2026-04-02T00:00:00.000Z')});
  `;

  return {
    sql,
    legacyCurrentAssessmentId: currentAssessmentId,
    legacyHistoricalAssessmentId: historicalAssessmentId,
    riskId,
    riskMethodVersionId,
    treatmentId,
    acceptanceId,
  };
}
