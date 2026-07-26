-- ==========================================
-- Paket 3.2: Risikobewertung
-- Relationale Risikobausteine, Evidence, ReviewTask
-- ==========================================

-- 1. Add displayId to Threat (for consistent ID pattern)
ALTER TABLE "threats" ADD COLUMN "displayId" VARCHAR;
UPDATE "threats" SET "displayId" = 'THR-' || "id" WHERE "displayId" IS NULL;
ALTER TABLE "threats" ALTER COLUMN "displayId" SET NOT NULL;
CREATE UNIQUE INDEX "threats_displayId_key" ON "threats"("displayId");

-- 2. Add displayId to Vulnerability
ALTER TABLE "vulnerabilities" ADD COLUMN "displayId" VARCHAR;
UPDATE "vulnerabilities" SET "displayId" = 'VULN-' || "id" WHERE "displayId" IS NULL;
ALTER TABLE "vulnerabilities" ALTER COLUMN "displayId" SET NOT NULL;
CREATE UNIQUE INDEX "vulnerabilities_displayId_key" ON "vulnerabilities"("displayId");

-- 3. Create RiskScenario table
CREATE TABLE "risk_scenarios" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "displayId" VARCHAR NOT NULL,
  "title" VARCHAR NOT NULL,
  "description" TEXT,
  "threatId" TEXT NOT NULL,
  "vulnerabilityId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" VARCHAR,
  "updatedBy" VARCHAR,
  CONSTRAINT "risk_scenarios_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "risk_scenarios_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "risk_scenarios_displayId_key" ON "risk_scenarios"("displayId");
CREATE INDEX "risk_scenarios_threatId_idx" ON "risk_scenarios"("threatId");

-- 4. Create RiskCause table
CREATE TABLE "risk_causes" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "displayId" VARCHAR NOT NULL,
  "title" VARCHAR NOT NULL,
  "description" TEXT,
  "category" VARCHAR,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" VARCHAR,
  "updatedBy" VARCHAR
);
CREATE UNIQUE INDEX "risk_causes_displayId_key" ON "risk_causes"("displayId");

-- 5. Create RiskImpact table
CREATE TABLE "risk_impacts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "displayId" VARCHAR NOT NULL,
  "title" VARCHAR NOT NULL,
  "description" TEXT,
  "category" VARCHAR,
  "severity" VARCHAR NOT NULL DEFAULT 'low',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" VARCHAR,
  "updatedBy" VARCHAR
);
CREATE UNIQUE INDEX "risk_impacts_displayId_key" ON "risk_impacts"("displayId");

-- 6. Create RiskCauseLink junction table (Risk <-> Cause M:N)
CREATE TABLE "risk_cause_links" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "riskId" TEXT NOT NULL,
  "causeId" TEXT NOT NULL,
  CONSTRAINT "risk_cause_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_cause_links_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "risk_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "risk_cause_links_riskId_causeId_key" ON "risk_cause_links"("riskId", "causeId");

-- 7. Create RiskImpactLink junction table (Risk <-> Impact M:N)
CREATE TABLE "risk_impact_links" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "riskId" TEXT NOT NULL,
  "impactId" TEXT NOT NULL,
  CONSTRAINT "risk_impact_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_impact_links_impactId_fkey" FOREIGN KEY ("impactId") REFERENCES "risk_impacts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "risk_impact_links_riskId_impactId_key" ON "risk_impact_links"("riskId", "impactId");

-- 8. Add scenarioId to Risk (relational reference)
ALTER TABLE "risks" ADD COLUMN "scenarioId" TEXT;
ALTER TABLE "risks" ADD CONSTRAINT "risks_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "risk_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "risks_scenarioId_idx" ON "risks"("scenarioId");

-- 9. Add proper FK relations for legacy threatId/vulnerabilityId if not already present
ALTER TABLE "risks" ADD CONSTRAINT "risks_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risks" ADD CONSTRAINT "risks_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. Add assessmentType to RiskAssessment and make justification mandatory
ALTER TABLE "risk_assessments" ADD COLUMN "assessmentType" VARCHAR NOT NULL DEFAULT 'current';
CREATE INDEX "risk_assessments_assessmentType_idx" ON "risk_assessments"("assessmentType");
UPDATE "risk_assessments" SET "justification" = 'Migrated assessment — justification required for new assessments' WHERE "justification" IS NULL;
ALTER TABLE "risk_assessments" ALTER COLUMN "justification" SET NOT NULL;

-- 11. Create ReviewTask table
CREATE TABLE "review_tasks" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "displayId" VARCHAR NOT NULL,
  "riskId" TEXT NOT NULL,
  "scheduledDate" TIMESTAMPTZ NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "priority" VARCHAR NOT NULL DEFAULT 'medium',
  "assignedTo" VARCHAR,
  "triggerType" VARCHAR NOT NULL DEFAULT 'scheduled',
  "triggerEventId" VARCHAR,
  "triggerSource" VARCHAR,
  "notes" TEXT,
  "completedAt" TIMESTAMPTZ,
  "completedBy" VARCHAR,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" VARCHAR,
  CONSTRAINT "review_tasks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "review_tasks_displayId_key" ON "review_tasks"("displayId");
CREATE INDEX "review_tasks_riskId_idx" ON "review_tasks"("riskId");
CREATE INDEX "review_tasks_status_idx" ON "review_tasks"("status");
CREATE INDEX "review_tasks_dueDate_idx" ON "review_tasks"("dueDate");
CREATE INDEX "review_tasks_assignedTo_idx" ON "review_tasks"("assignedTo");
