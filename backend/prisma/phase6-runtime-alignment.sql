-- Targeted, idempotent Phase 6 runtime alignment for /isms-operations resource list endpoints.
-- This is intentionally narrower than a full Prisma migration because live migration history is drifted.

-- Existing drifted Phase 6 tables: add columns Prisma currently selects.
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "displayId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "processId" TEXT;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "mtpdMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "rtoMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "rpoMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "impactCategories" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "business_impact_analyses" ALTER COLUMN "timeDependentImpacts" SET DEFAULT '{}'::jsonb;
UPDATE "business_impact_analyses" SET "timeDependentImpacts" = '{}'::jsonb WHERE "timeDependentImpacts" IS NULL;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "requiredResources" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "lastReviewDate" TIMESTAMP(3);
ALTER TABLE "business_impact_analyses" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);

ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "auditPlanId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "displayId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "requirementIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "controlIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "assetIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "riskIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "audit_findings" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "displayId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "rootCause" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "containmentActions" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "correctiveActions" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "effectivenessCriteria" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "effectivenessStatus" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "effectivenessReviewedAt" TIMESTAMP(3);
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "displayId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "chairId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "agenda" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "inputs" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "decisions" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "minutes" TEXT;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "management_reviews" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'management_reviews' AND column_name = 'participants' AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE "management_reviews" ALTER COLUMN "participants" DROP DEFAULT;
    ALTER TABLE "management_reviews" ALTER COLUMN "participants" TYPE JSONB USING to_jsonb("participants");
  END IF;
END $$;
ALTER TABLE "management_reviews" ALTER COLUMN "participants" SET DEFAULT '[]'::jsonb;
UPDATE "management_reviews" SET "participants" = '[]'::jsonb WHERE "participants" IS NULL;
ALTER TABLE "management_reviews" ALTER COLUMN "participants" SET NOT NULL;

ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "definitionId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "entityId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "currentState" TEXT NOT NULL DEFAULT '';
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "context" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
UPDATE "workflow_instances" SET "definitionId" = "workflowId" WHERE "definitionId" = '' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workflow_instances' AND column_name='workflowId');
UPDATE "workflow_instances" SET "entityType" = "objectType" WHERE "entityType" = '' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workflow_instances' AND column_name='objectType');
UPDATE "workflow_instances" SET "entityId" = "objectId" WHERE "entityId" = '' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workflow_instances' AND column_name='objectId');
UPDATE "workflow_instances" SET "currentState" = "currentStep" WHERE "currentState" = '' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workflow_instances' AND column_name='currentStep');

-- Missing Phase 6 tables used by PHASE6_MODEL_MAP.
CREATE TABLE IF NOT EXISTS "supplier_assessments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "assessorId" TEXT NOT NULL,
  "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentType" TEXT NOT NULL DEFAULT 'initial',
  "questionnaire" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "score" INTEGER,
  "rating" TEXT NOT NULL DEFAULT 'medium',
  "findings" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "actions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "nextAssessmentDate" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT
);

CREATE TABLE IF NOT EXISTS "business_continuity_plans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT '',
  "biaId" TEXT,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "scope" TEXT,
  "recoveryStrategies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "communicationPlan" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "activationCriteria" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "nextTestDate" TIMESTAMP(3),
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "bcp_exercises" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bcpId" TEXT NOT NULL,
  "exerciseType" TEXT NOT NULL DEFAULT 'tabletop',
  "plannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt" TIMESTAMP(3),
  "participants" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "results" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "findings" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_programs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT '',
  "year" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  "scope" TEXT NOT NULL DEFAULT '',
  "objectives" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "criteria" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_plans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "programId" TEXT,
  "auditType" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT '',
  "scope" TEXT NOT NULL DEFAULT '',
  "criteria" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "auditorIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "auditeeIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "plannedStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "plannedEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "report" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "training_courses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT '',
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'security_awareness',
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "validityMonths" INTEGER,
  "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "training_assignments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "reminderLevel" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "training_completions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "score" INTEGER,
  "result" TEXT NOT NULL DEFAULT 'passed',
  "certificateUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdBy" TEXT
);

CREATE TABLE IF NOT EXISTS "training_acknowledgements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" TEXT
);

CREATE TABLE IF NOT EXISTS "management_review_actions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reviewId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "ownerId" TEXT NOT NULL DEFAULT '',
  "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'open',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "security_objectives" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT '',
  "description" TEXT,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "targetValue" DECIMAL(65,30),
  "targetUnit" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "metric_definitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "objectiveId" TEXT,
  "name" TEXT NOT NULL DEFAULT '',
  "metricType" TEXT NOT NULL DEFAULT 'KPI',
  "description" TEXT,
  "unit" TEXT,
  "aggregation" TEXT NOT NULL DEFAULT 'latest',
  "thresholds" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "metric_values" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "metricId" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "source" TEXT,
  "comment" TEXT,
  "trend" TEXT,
  "breachStatus" TEXT NOT NULL DEFAULT 'none',
  "breachDetails" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT
);

CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL DEFAULT '',
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "entityType" TEXT NOT NULL DEFAULT '',
  "states" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "transitions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "approvalRules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dueDateRules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "workflow_tasks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanceId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "assigneeId" TEXT,
  "taskType" TEXT NOT NULL DEFAULT 'approval',
  "status" TEXT NOT NULL DEFAULT 'open',
  "dueDate" TIMESTAMP(3),
  "decision" TEXT,
  "comment" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "workflow_transition_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanceId" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT NOT NULL,
  "transition" TEXT NOT NULL,
  "performedBy" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "report_definitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayId" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL DEFAULT '',
  "description" TEXT,
  "module" TEXT NOT NULL DEFAULT '',
  "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "columns" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "format" TEXT NOT NULL DEFAULT 'json',
  "schedule" JSONB,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "report_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "definitionId" TEXT,
  "module" TEXT NOT NULL DEFAULT '',
  "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "format" TEXT NOT NULL DEFAULT 'json',
  "status" TEXT NOT NULL DEFAULT 'running',
  "result" JSONB,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT
);

CREATE TABLE IF NOT EXISTS "export_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL DEFAULT '',
  "entityId" TEXT,
  "format" TEXT NOT NULL DEFAULT 'json',
  "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "payload" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "requestedBy" TEXT NOT NULL DEFAULT '',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

-- Non-unique indexes useful for list filters/order. Created idempotently and safely.
CREATE INDEX IF NOT EXISTS "supplier_assessments_supplierId_idx" ON "supplier_assessments"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_assessments_nextAssessmentDate_idx" ON "supplier_assessments"("nextAssessmentDate");
CREATE INDEX IF NOT EXISTS "business_impact_analyses_nextReviewDate_idx" ON "business_impact_analyses"("nextReviewDate");
CREATE INDEX IF NOT EXISTS "business_continuity_plans_nextTestDate_idx" ON "business_continuity_plans"("nextTestDate");
CREATE INDEX IF NOT EXISTS "bcp_exercises_plannedAt_status_idx" ON "bcp_exercises"("plannedAt", "status");
CREATE INDEX IF NOT EXISTS "audit_programs_year_status_idx" ON "audit_programs"("year", "status");
CREATE INDEX IF NOT EXISTS "audit_plans_plannedStart_status_idx" ON "audit_plans"("plannedStart", "status");
CREATE INDEX IF NOT EXISTS "audit_findings_dueDate_status_idx" ON "audit_findings"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "corrective_actions_dueDate_status_idx" ON "corrective_actions"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "training_courses_category_status_idx" ON "training_courses"("category", "status");
CREATE INDEX IF NOT EXISTS "training_assignments_dueDate_status_idx" ON "training_assignments"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "management_reviews_nextReviewDate_idx" ON "management_reviews"("nextReviewDate");
CREATE INDEX IF NOT EXISTS "management_review_actions_dueDate_status_idx" ON "management_review_actions"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "security_objectives_ownerId_status_idx" ON "security_objectives"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "metric_definitions_metricType_status_idx" ON "metric_definitions"("metricType", "status");
CREATE INDEX IF NOT EXISTS "metric_values_breachStatus_idx" ON "metric_values"("breachStatus");
CREATE INDEX IF NOT EXISTS "workflow_definitions_entityType_status_idx" ON "workflow_definitions"("entityType", "status");
CREATE INDEX IF NOT EXISTS "workflow_instances_dueDate_status_idx" ON "workflow_instances"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "workflow_tasks_dueDate_status_idx" ON "workflow_tasks"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "report_definitions_module_status_idx" ON "report_definitions"("module", "status");
CREATE INDEX IF NOT EXISTS "report_runs_module_startedAt_idx" ON "report_runs"("module", "startedAt");
CREATE INDEX IF NOT EXISTS "export_jobs_requestedBy_idx" ON "export_jobs"("requestedBy");
