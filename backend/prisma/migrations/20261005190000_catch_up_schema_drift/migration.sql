-- Catch-up migration for databases that drifted via `prisma db push`.
-- IMPORTANT: this migration must be fully idempotent because some databases
-- already received parts of these changes through other (idempotent) migrations.
-- Every drop/create/rename is therefore guarded with IF EXISTS / IF NOT EXISTS.

-- DropForeignKey
ALTER TABLE "risk_method_versions" DROP CONSTRAINT IF EXISTS "risk_method_versions_riskMethodId_fkey";

-- DropForeignKey
ALTER TABLE "risks" DROP CONSTRAINT IF EXISTS "risks_riskMethodVersionId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT IF EXISTS "webhook_deliveries_webhookId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "audit_logs_sequence_idx";

-- DropIndex
DROP INDEX IF EXISTS "incidents_nis2_final_report_due_idx";

-- DropIndex
DROP INDEX IF EXISTS "incidents_nis2_relevant_idx";

-- DropIndex
DROP INDEX IF EXISTS "incidents_nis2_report_deadline_idx";

-- DropIndex
DROP INDEX IF EXISTS "service_accounts_userId_idx";

-- DropIndex
DROP INDEX IF EXISTS "tickets_managerId_idx";

-- DropIndex
DROP INDEX IF EXISTS "tickets_requesterId_idx";

-- DropIndex
DROP INDEX IF EXISTS "webhook_deliveries_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "webhook_deliveries_webhookId_idx";

-- DropIndex
DROP INDEX IF EXISTS "webhooks_isActive_idx";

-- AlterTable
ALTER TABLE "api_audit_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "correlationId" SET DATA TYPE TEXT,
ALTER COLUMN "method" SET DATA TYPE TEXT,
ALTER COLUMN "path" SET DATA TYPE TEXT,
ALTER COLUMN "requestSize" SET NOT NULL,
ALTER COLUMN "responseSize" SET NOT NULL,
ALTER COLUMN "ipAddress" SET DATA TYPE TEXT,
ALTER COLUMN "idempotencyKey" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_rate_limits" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "endpointPattern" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_scopes" DROP CONSTRAINT IF EXISTS "api_scopes_pkey",
ALTER COLUMN "scope" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_scopes_pkey') THEN
    ALTER TABLE "api_scopes" ADD CONSTRAINT "api_scopes_pkey" PRIMARY KEY ("scope");
  END IF;
END $$;

-- AlterTable
ALTER TABLE "audit_checkpoints" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_findings" DROP COLUMN IF EXISTS "auditId",
DROP COLUMN IF EXISTS "evidenceIds",
DROP COLUMN IF EXISTS "relatedAssetIds",
DROP COLUMN IF EXISTS "relatedControlIds",
DROP COLUMN IF EXISTS "relatedRequirementIds",
DROP COLUMN IF EXISTS "relatedRiskIds",
ADD COLUMN IF NOT EXISTS "assetIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "auditPlanId" TEXT,
ADD COLUMN IF NOT EXISTS "controlIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "displayId" TEXT,
ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
ADD COLUMN IF NOT EXISTS "requirementIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "riskIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS "title" TEXT;

-- AlterTable
ALTER TABLE "auth_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_impact_analyses" DROP COLUMN IF EXISTS "businessProcessOrService",
DROP COLUMN IF EXISTS "dependentAssets",
DROP COLUMN IF EXISTS "dependentCommunication",
DROP COLUMN IF EXISTS "dependentSuppliers",
DROP COLUMN IF EXISTS "emergencyProcedures",
DROP COLUMN IF EXISTS "maximumTolerablePause",
DROP COLUMN IF EXISTS "processOwnerId",
DROP COLUMN IF EXISTS "recoveryPointObjective",
DROP COLUMN IF EXISTS "recoveryTimeObjective",
DROP COLUMN IF EXISTS "requiredLocations",
DROP COLUMN IF EXISTS "requiredPersonnel",
ADD COLUMN IF NOT EXISTS "displayId" TEXT,
ADD COLUMN IF NOT EXISTS "impactCategories" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "lastReviewDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "mtpdMinutes" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
ADD COLUMN IF NOT EXISTS "processId" TEXT,
ADD COLUMN IF NOT EXISTS "requiredResources" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "rpoMinutes" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rtoMinutes" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "serviceId" TEXT,
ADD COLUMN IF NOT EXISTS "title" TEXT,
ALTER COLUMN "timeDependentImpacts" SET DEFAULT '{}',
ALTER COLUMN "status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "control_actions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "control_catalog_items" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "crosswalk" DROP DEFAULT;

-- AlterTable
ALTER TABLE "control_catalogs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "control_findings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "control_implementations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "corrective_actions" DROP COLUMN IF EXISTS "implementationStatus",
DROP COLUMN IF EXISTS "responsibleId",
DROP COLUMN IF EXISTS "targetDate",
ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "containmentActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "correctiveActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "effectivenessCriteria" TEXT,
ADD COLUMN IF NOT EXISTS "effectivenessReviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "effectivenessStatus" TEXT,
ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
ADD COLUMN IF NOT EXISTS "title" TEXT;

-- AlterTable
ALTER TABLE "idempotency_keys" DROP CONSTRAINT IF EXISTS "idempotency_keys_pkey",
ALTER COLUMN "key" SET DATA TYPE TEXT,
ALTER COLUMN "httpMethod" SET DATA TYPE TEXT,
ALTER COLUMN "routePattern" SET DATA TYPE TEXT,
ALTER COLUMN "requestBodyHash" SET DATA TYPE TEXT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_pkey') THEN
    ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key");
  END IF;
END $$;

-- AlterTable
ALTER TABLE "incident_communications" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incident_escalations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incident_knowledge_time_changes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incident_reports" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incidents" ALTER COLUMN "nis2ReportedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "nis2ReportDeadline" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "nis2FinalReportDue" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_leases" DROP CONSTRAINT IF EXISTS "job_leases_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobName" SET DATA TYPE TEXT,
ALTER COLUMN "ownerId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_leases_pkey') THEN
    ALTER TABLE "job_leases" ADD CONSTRAINT "job_leases_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- AlterTable
ALTER TABLE "job_runs" DROP CONSTRAINT IF EXISTS "job_runs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobId" SET DATA TYPE TEXT,
ALTER COLUMN "jobType" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "workerId" SET DATA TYPE TEXT,
ALTER COLUMN "scheduledAt" DROP NOT NULL,
ALTER COLUMN "scheduledAt" DROP DEFAULT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_runs_pkey') THEN
    ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- AlterTable
ALTER TABLE "licenses" ALTER COLUMN "licensingBasis" SET DATA TYPE TEXT,
ALTER COLUMN "assignmentModel" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "management_reviews" DROP COLUMN IF EXISTS "auditResults",
DROP COLUMN IF EXISTS "contextChanges",
DROP COLUMN IF EXISTS "correctiveActionsStatus",
DROP COLUMN IF EXISTS "date",
DROP COLUMN IF EXISTS "incidentSummary",
DROP COLUMN IF EXISTS "kpis",
DROP COLUMN IF EXISTS "managementDecisions",
DROP COLUMN IF EXISTS "newActions",
DROP COLUMN IF EXISTS "newResponsibilities",
DROP COLUMN IF EXISTS "previousActionsStatus",
DROP COLUMN IF EXISTS "resourceNeeds",
DROP COLUMN IF EXISTS "riskDevelopment",
DROP COLUMN IF EXISTS "securityGoals",
ADD COLUMN IF NOT EXISTS "agenda" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
ADD COLUMN IF NOT EXISTS "chairId" TEXT,
ADD COLUMN IF NOT EXISTS "decisions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "displayId" TEXT,
ADD COLUMN IF NOT EXISTS "inputs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "minutes" TEXT,
ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "title" TEXT,
ALTER COLUMN "status" SET DEFAULT 'planned';

-- AlterTable
ALTER TABLE "nis2_incident_significance_rule_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nis2_questionnaire_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nis2_registration_changes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "oidc_account_links" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "problems" ALTER COLUMN "relatedIncidentIds" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "reminder_config" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reminder_delivery_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "requirements" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "review_tasks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "scheduledDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "dueDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "priority" SET DATA TYPE TEXT,
ALTER COLUMN "assignedTo" SET DATA TYPE TEXT,
ALTER COLUMN "triggerType" SET DATA TYPE TEXT,
ALTER COLUMN "triggerEventId" SET DATA TYPE TEXT,
ALTER COLUMN "triggerSource" SET DATA TYPE TEXT,
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completedBy" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "risk_cause_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "risk_causes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "updatedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "risk_impact_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "risk_impacts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
ALTER COLUMN "severity" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "updatedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "risk_method_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "versionTag" SET DATA TYPE TEXT,
ALTER COLUMN "calculationType" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "risk_methods" DROP COLUMN IF EXISTS "formula",
ALTER COLUMN "calculationType" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "risk_scenarios" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "updatedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "service_accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "accessTokenHash" SET DATA TYPE TEXT,
ALTER COLUMN "accessTokenSalt" SET DATA TYPE TEXT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastUsedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "updatedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "sla_configs" DROP COLUMN IF EXISTS "escalationLevels",
ADD COLUMN IF NOT EXISTS "escalationLevels" JSONB NOT NULL DEFAULT '[1,2,3]';

-- AlterTable
ALTER TABLE "soa_items" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "accessMethods",
DROP COLUMN IF EXISTS "affectedAssets",
DROP COLUMN IF EXISTS "contractPeriod",
DROP COLUMN IF EXISTS "exitRules",
DROP COLUMN IF EXISTS "locations",
DROP COLUMN IF EXISTS "processedDataTypes",
DROP COLUMN IF EXISTS "productsAndServices",
DROP COLUMN IF EXISTS "riskAssessment",
DROP COLUMN IF EXISTS "subcontractors",
DROP COLUMN IF EXISTS "supportedBusinessProcesses",
ALTER COLUMN "displayId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "threats" ALTER COLUMN "displayId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "vulnerabilities" ALTER COLUMN "displayId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "webhook_deliveries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "eventId" SET DATA TYPE TEXT,
ALTER COLUMN "url" SET DATA TYPE TEXT,
ALTER COLUMN "httpMethod" SET DATA TYPE TEXT,
ALTER COLUMN "requestBodyHash" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_delivery_attempts" DROP COLUMN IF EXISTS "createdAt",
ADD COLUMN IF NOT EXISTS "status" TEXT,
ALTER COLUMN "startedAt" DROP DEFAULT;

-- Convert a legacy enum-typed status column to TEXT before dropping the enum type.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_delivery_attempts' AND column_name = 'status'
      AND udt_name = 'WebhookDeliveryAttemptStatus'
  ) THEN
    ALTER TABLE "webhook_delivery_attempts" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "url" SET DATA TYPE TEXT,
ALTER COLUMN "secret" SET DATA TYPE TEXT,
ALTER COLUMN "lastDeliveryStatus" SET DATA TYPE TEXT,
ALTER COLUMN "lastDeliveredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "updatedBy" SET DATA TYPE TEXT,
ALTER COLUMN "events" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workflow_instances" DROP COLUMN IF EXISTS "currentStep",
DROP COLUMN IF EXISTS "objectId",
DROP COLUMN IF EXISTS "objectType",
DROP COLUMN IF EXISTS "workflowId",
ADD COLUMN IF NOT EXISTS "context" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "currentState" TEXT,
ADD COLUMN IF NOT EXISTS "definitionId" TEXT,
ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "entityId" TEXT,
ADD COLUMN IF NOT EXISTS "entityType" TEXT,
ALTER COLUMN "status" SET DEFAULT 'running';

-- DropTable
DROP TABLE IF EXISTS "audits";

-- DropTable
DROP TABLE IF EXISTS "risk_assessment_legacy_id_map";

-- DropTable
DROP TABLE IF EXISTS "trainings";

-- DropTable
DROP TABLE IF EXISTS "workflows";

-- DropEnum
DROP TYPE IF EXISTS "WebhookDeliveryAttemptStatus";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "audit_findings_displayId_key" ON "audit_findings"("displayId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_findings_auditPlanId_idx" ON "audit_findings"("auditPlanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_findings_dueDate_status_idx" ON "audit_findings"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_impact_analyses_displayId_key" ON "business_impact_analyses"("displayId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_impact_analyses_processId_idx" ON "business_impact_analyses"("processId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_impact_analyses_serviceId_idx" ON "business_impact_analyses"("serviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_impact_analyses_nextReviewDate_idx" ON "business_impact_analyses"("nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "control_catalogs_name_key" ON "control_catalogs"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "corrective_actions_sourceType_sourceId_idx" ON "corrective_actions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "corrective_actions_dueDate_status_idx" ON "corrective_actions"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "management_reviews_displayId_key" ON "management_reviews"("displayId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "management_reviews_reviewDate_status_idx" ON "management_reviews"("reviewDate", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "management_reviews_nextReviewDate_idx" ON "management_reviews"("nextReviewDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organization_units_legalEntityId_idx" ON "organization_units"("legalEntityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_delivery_attempts_webhookId_status_idx" ON "webhook_delivery_attempts"("webhookId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_delivery_attempts_status_idx" ON "webhook_delivery_attempts"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhooks_events_idx" ON "webhooks"("events");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_instances_definitionId_idx" ON "workflow_instances"("definitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workflow_instances_dueDate_status_idx" ON "workflow_instances"("dueDate", "status");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_legalEntityId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_organizationUnitId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_scopeId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_siteId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_legalEntityId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_organizationUnitId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_scopeId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_siteId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_units_legalEntityId_fkey') THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_method_versions_riskMethodId_fkey') THEN
    ALTER TABLE "risk_method_versions" ADD CONSTRAINT "risk_method_versions_riskMethodId_fkey" FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_riskMethodVersionId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_implementations_scopeId_fkey') THEN
    ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_implementations_organizationUnitId_fkey') THEN
    ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_implementations_siteId_fkey') THEN
    ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_accounts_userId_fkey') THEN
    ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_audit_logs_serviceAccountId_fkey') THEN
    ALTER TABLE "api_audit_logs" ADD CONSTRAINT "api_audit_logs_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_serviceAccountId_fkey') THEN
    ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_webhookId_fkey') THEN
    ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_delivery_attempts_webhookId_fkey') THEN
    ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_catalog_items_catalogId_fkey') THEN
    ALTER TABLE "control_catalog_items" ADD CONSTRAINT "control_catalog_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "control_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'control_catalog_items_catalogId_controlId_unique')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'control_catalog_items_catalogId_controlId_key') THEN
    ALTER INDEX "control_catalog_items_catalogId_controlId_unique" RENAME TO "control_catalog_items_catalogId_controlId_key";
  END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'risk_control_assessments_riskControlId_riskAssessmentVersionId_')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'risk_control_assessments_riskControlId_riskAssessmentVersio_key') THEN
    ALTER INDEX "risk_control_assessments_riskControlId_riskAssessmentVersionId_" RENAME TO "risk_control_assessments_riskControlId_riskAssessmentVersio_key";
  END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'soa_item_control_implementations_soaItemId_controlImplementatio')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'soa_item_control_implementations_soaItemId_controlImplement_key') THEN
    ALTER INDEX "soa_item_control_implementations_soaItemId_controlImplementatio" RENAME TO "soa_item_control_implementations_soaItemId_controlImplement_key";
  END IF;
END $$;
