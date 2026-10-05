-- DropForeignKey
ALTER TABLE "risk_method_versions" DROP CONSTRAINT "risk_method_versions_riskMethodId_fkey";

-- DropForeignKey
ALTER TABLE "risks" DROP CONSTRAINT "risks_riskMethodVersionId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_webhookId_fkey";

-- DropIndex
DROP INDEX "audit_logs_sequence_idx";

-- DropIndex
DROP INDEX "incidents_nis2_final_report_due_idx";

-- DropIndex
DROP INDEX "incidents_nis2_relevant_idx";

-- DropIndex
DROP INDEX "incidents_nis2_report_deadline_idx";

-- DropIndex
DROP INDEX "service_accounts_userId_idx";

-- DropIndex
DROP INDEX "tickets_managerId_idx";

-- DropIndex
DROP INDEX "tickets_requesterId_idx";

-- DropIndex
DROP INDEX "webhook_deliveries_createdAt_idx";

-- DropIndex
DROP INDEX "webhook_deliveries_webhookId_idx";

-- DropIndex
DROP INDEX "webhooks_isActive_idx";

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
ALTER TABLE "api_scopes" DROP CONSTRAINT "api_scopes_pkey",
ALTER COLUMN "scope" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "api_scopes_pkey" PRIMARY KEY ("scope");

-- AlterTable
ALTER TABLE "audit_checkpoints" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_findings" DROP COLUMN "auditId",
DROP COLUMN "evidenceIds",
DROP COLUMN "relatedAssetIds",
DROP COLUMN "relatedControlIds",
DROP COLUMN "relatedRequirementIds",
DROP COLUMN "relatedRiskIds",
ADD COLUMN     "assetIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "auditPlanId" TEXT NOT NULL,
ADD COLUMN     "controlIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "displayId" TEXT NOT NULL,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "requirementIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "riskIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "auth_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_impact_analyses" DROP COLUMN "businessProcessOrService",
DROP COLUMN "dependentAssets",
DROP COLUMN "dependentCommunication",
DROP COLUMN "dependentSuppliers",
DROP COLUMN "emergencyProcedures",
DROP COLUMN "maximumTolerablePause",
DROP COLUMN "processOwnerId",
DROP COLUMN "recoveryPointObjective",
DROP COLUMN "recoveryTimeObjective",
DROP COLUMN "requiredLocations",
DROP COLUMN "requiredPersonnel",
ADD COLUMN     "displayId" TEXT NOT NULL,
ADD COLUMN     "impactCategories" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lastReviewDate" TIMESTAMP(3),
ADD COLUMN     "mtpdMinutes" INTEGER NOT NULL,
ADD COLUMN     "nextReviewDate" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "processId" TEXT,
ADD COLUMN     "requiredResources" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rpoMinutes" INTEGER NOT NULL,
ADD COLUMN     "rtoMinutes" INTEGER NOT NULL,
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
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
ALTER TABLE "corrective_actions" DROP COLUMN "implementationStatus",
DROP COLUMN "responsibleId",
DROP COLUMN "targetDate",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "containmentActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "correctiveActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "effectivenessCriteria" TEXT,
ADD COLUMN     "effectivenessReviewedAt" TIMESTAMP(3),
ADD COLUMN     "effectivenessStatus" TEXT,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_pkey",
ALTER COLUMN "key" SET DATA TYPE TEXT,
ALTER COLUMN "httpMethod" SET DATA TYPE TEXT,
ALTER COLUMN "routePattern" SET DATA TYPE TEXT,
ALTER COLUMN "requestBodyHash" SET DATA TYPE TEXT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key");

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
ALTER TABLE "job_leases" DROP CONSTRAINT "job_leases_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobName" SET DATA TYPE TEXT,
ALTER COLUMN "ownerId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "job_leases_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "job_runs" DROP CONSTRAINT "job_runs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobId" SET DATA TYPE TEXT,
ALTER COLUMN "jobType" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "workerId" SET DATA TYPE TEXT,
ALTER COLUMN "scheduledAt" DROP NOT NULL,
ALTER COLUMN "scheduledAt" DROP DEFAULT,
ADD CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "licenses" ALTER COLUMN "licensingBasis" SET DATA TYPE TEXT,
ALTER COLUMN "assignmentModel" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "management_reviews" DROP COLUMN "auditResults",
DROP COLUMN "contextChanges",
DROP COLUMN "correctiveActionsStatus",
DROP COLUMN "date",
DROP COLUMN "incidentSummary",
DROP COLUMN "kpis",
DROP COLUMN "managementDecisions",
DROP COLUMN "newActions",
DROP COLUMN "newResponsibilities",
DROP COLUMN "previousActionsStatus",
DROP COLUMN "resourceNeeds",
DROP COLUMN "riskDevelopment",
DROP COLUMN "securityGoals",
ADD COLUMN     "agenda" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "chairId" TEXT NOT NULL,
ADD COLUMN     "decisions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "displayId" TEXT NOT NULL,
ADD COLUMN     "inputs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "minutes" TEXT,
ADD COLUMN     "nextReviewDate" TIMESTAMP(3),
ADD COLUMN     "reviewDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
DROP COLUMN "participants",
ADD COLUMN     "participants" JSONB NOT NULL DEFAULT '[]',
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
ALTER TABLE "risk_methods" DROP COLUMN "formula",
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
ALTER COLUMN "displayId" SET NOT NULL,
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
ALTER TABLE "sla_configs" DROP COLUMN "escalationLevels",
ADD COLUMN     "escalationLevels" JSONB NOT NULL DEFAULT '[1,2,3]';

-- AlterTable
ALTER TABLE "soa_items" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "accessMethods",
DROP COLUMN "affectedAssets",
DROP COLUMN "contractPeriod",
DROP COLUMN "exitRules",
DROP COLUMN "locations",
DROP COLUMN "processedDataTypes",
DROP COLUMN "productsAndServices",
DROP COLUMN "riskAssessment",
DROP COLUMN "subcontractors",
DROP COLUMN "supportedBusinessProcesses",
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
ALTER COLUMN "eventType" SET NOT NULL,
ALTER COLUMN "payload" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_delivery_attempts" DROP COLUMN "createdAt",
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL,
ALTER COLUMN "startedAt" DROP DEFAULT,
ALTER COLUMN "completedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "displayId" SET NOT NULL,
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
ALTER TABLE "workflow_instances" DROP COLUMN "currentStep",
DROP COLUMN "objectId",
DROP COLUMN "objectType",
DROP COLUMN "workflowId",
ADD COLUMN     "context" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "currentState" TEXT NOT NULL,
ADD COLUMN     "definitionId" TEXT NOT NULL,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'running';

-- DropTable
DROP TABLE "audits";

-- DropTable
DROP TABLE "risk_assessment_legacy_id_map";

-- DropTable
DROP TABLE "trainings";

-- DropTable
DROP TABLE "workflows";

-- DropEnum
DROP TYPE "WebhookDeliveryAttemptStatus";

-- CreateIndex
CREATE UNIQUE INDEX "audit_findings_displayId_key" ON "audit_findings"("displayId");

-- CreateIndex
CREATE INDEX "audit_findings_auditPlanId_idx" ON "audit_findings"("auditPlanId");

-- CreateIndex
CREATE INDEX "audit_findings_dueDate_status_idx" ON "audit_findings"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_impact_analyses_displayId_key" ON "business_impact_analyses"("displayId");

-- CreateIndex
CREATE INDEX "business_impact_analyses_processId_idx" ON "business_impact_analyses"("processId");

-- CreateIndex
CREATE INDEX "business_impact_analyses_serviceId_idx" ON "business_impact_analyses"("serviceId");

-- CreateIndex
CREATE INDEX "business_impact_analyses_nextReviewDate_idx" ON "business_impact_analyses"("nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "control_catalogs_name_key" ON "control_catalogs"("name");

-- CreateIndex
CREATE INDEX "corrective_actions_sourceType_sourceId_idx" ON "corrective_actions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "corrective_actions_dueDate_status_idx" ON "corrective_actions"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "management_reviews_displayId_key" ON "management_reviews"("displayId");

-- CreateIndex
CREATE INDEX "management_reviews_reviewDate_status_idx" ON "management_reviews"("reviewDate", "status");

-- CreateIndex
CREATE INDEX "management_reviews_nextReviewDate_idx" ON "management_reviews"("nextReviewDate");

-- CreateIndex
CREATE INDEX "organization_units_legalEntityId_idx" ON "organization_units"("legalEntityId");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_webhookId_status_idx" ON "webhook_delivery_attempts"("webhookId", "status");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_status_idx" ON "webhook_delivery_attempts"("status");

-- CreateIndex
CREATE INDEX "webhooks_events_idx" ON "webhooks"("events");

-- CreateIndex
CREATE INDEX "workflow_instances_definitionId_idx" ON "workflow_instances"("definitionId");

-- CreateIndex
CREATE INDEX "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "workflow_instances_dueDate_status_idx" ON "workflow_instances"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_method_versions" ADD CONSTRAINT "risk_method_versions_riskMethodId_fkey" FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_audit_logs" ADD CONSTRAINT "api_audit_logs_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_catalog_items" ADD CONSTRAINT "control_catalog_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "control_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "control_catalog_items_catalogId_controlId_unique" RENAME TO "control_catalog_items_catalogId_controlId_key";

-- RenameIndex
ALTER INDEX "risk_control_assessments_riskControlId_riskAssessmentVersionId_" RENAME TO "risk_control_assessments_riskControlId_riskAssessmentVersio_key";

-- RenameIndex
ALTER INDEX "soa_item_control_implementations_soaItemId_controlImplementatio" RENAME TO "soa_item_control_implementations_soaItemId_controlImplement_key";

