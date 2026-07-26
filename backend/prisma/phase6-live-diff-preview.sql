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
ALTER TABLE "control_catalog_items" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "corrective_actions" DROP COLUMN "implementationStatus",
DROP COLUMN "responsibleId",
DROP COLUMN "targetDate",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "containmentActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "correctiveActions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "displayId" TEXT NOT NULL,
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
ALTER TABLE "document_versions" ADD COLUMN     "isImmutable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "isImmutable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextReviewDate" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "reviewIntervalDays" INTEGER,
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "workflowStatus" TEXT NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "deleteProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "relatedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relatedDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relatedSoAItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "retentionUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "intune_sync_status" ADD COLUMN     "staleCount" INTEGER NOT NULL DEFAULT 0;

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
ALTER TABLE "nis2_assessments" ADD COLUMN     "answers" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "preliminaryJustification" TEXT,
ADD COLUMN     "preliminaryResult" TEXT,
ADD COLUMN     "questionnaireVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "submittedForApprovalAt" TIMESTAMP(3),
ADD COLUMN     "submittedForApprovalBy" TEXT;

-- AlterTable
ALTER TABLE "nis2_incident_significance_rule_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nis2_registrations" ADD COLUMN     "assessmentId" TEXT;

-- AlterTable
ALTER TABLE "policy_documents" ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "isImmutable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextReviewDate" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "reviewIntervalDays" INTEGER,
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "risk_methods" DROP COLUMN "formula",
ADD COLUMN     "calculationType" TEXT NOT NULL DEFAULT 'product',
ADD COLUMN     "formulaExpression" TEXT;

-- AlterTable
ALTER TABLE "risk_treatments" ADD COLUMN     "assessmentId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "residualAssessmentId" TEXT;

-- AlterTable
ALTER TABLE "risks" ALTER COLUMN "riskMethodVersionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "statements_of_applicability" ADD COLUMN     "isImmutable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedBy" TEXT,
ALTER COLUMN "controls" DROP NOT NULL;

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
ALTER COLUMN "displayId" DROP DEFAULT,
ALTER COLUMN "displayId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "threats" ADD COLUMN     "displayId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vulnerabilities" ADD COLUMN     "displayId" TEXT NOT NULL;

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
DROP TABLE "trainings";

-- DropTable
DROP TABLE "workflows";

-- CreateTable
CREATE TABLE "integration_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "integration_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_records" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceData" JSONB NOT NULL,
    "targetAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "action" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_conflicts" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "importRecordId" TEXT,
    "assetId" TEXT,
    "fieldName" TEXT NOT NULL,
    "existingValue" JSONB,
    "incomingValue" JSONB,
    "winningValue" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_provenance" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "importRunId" TEXT,
    "sourceRecordId" TEXT,
    "value" JSONB,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setBy" TEXT,

    CONSTRAINT "field_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_locks" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "reason" TEXT,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "field_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_priorities" (
    "id" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_method_versions" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "risk_method_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_acceptances" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_treatment_approvals" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvalLevel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_treatment_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_treatment_effectiveness_reviews" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_treatment_effectiveness_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scenarios" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "threatId" TEXT NOT NULL,
    "vulnerabilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risk_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_causes" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risk_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_impacts" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risk_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_cause_links" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,

    CONSTRAINT "risk_cause_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_impact_links" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "impactId" TEXT NOT NULL,

    CONSTRAINT "risk_impact_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_tasks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignedTo" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'scheduled',
    "triggerEventId" TEXT,
    "triggerSource" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_versions" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "licenseInfo" TEXT,
    "changelog" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "framework_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "frameworkVersionId" TEXT NOT NULL,
    "requirementKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requirementText" TEXT NOT NULL,
    "section" TEXT,
    "clauseNumber" TEXT,
    "parentKey" TEXT,
    "sortOrder" INTEGER,
    "licenseNotice" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_requirement_mappings" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL DEFAULT 'fully_fulfills',
    "coverage" TEXT NOT NULL DEFAULT 'full',
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "control_requirement_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_implementations" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "scopeId" TEXT,
    "organizationUnitId" TEXT,
    "siteId" TEXT,
    "responsibleUserId" TEXT NOT NULL,
    "implementationStatus" TEXT NOT NULL DEFAULT 'planned',
    "maturityLevel" INTEGER NOT NULL DEFAULT 0,
    "implementationDescription" TEXT,
    "testMethod" TEXT,
    "testFrequency" TEXT,
    "lastTestDate" TIMESTAMP(3),
    "nextTestDate" TIMESTAMP(3),
    "findingsSummary" TEXT,
    "actionsSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "control_implementations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_implementation_requirements" (
    "id" TEXT NOT NULL,
    "implementationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,

    CONSTRAINT "control_implementation_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_findings" (
    "id" TEXT NOT NULL,
    "implementationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "control_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_actions" (
    "id" TEXT NOT NULL,
    "implementationId" TEXT NOT NULL,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibleUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "control_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soa_items" (
    "id" TEXT NOT NULL,
    "soaId" TEXT NOT NULL,
    "requirementId" TEXT,
    "controlId" TEXT,
    "applicability" TEXT NOT NULL DEFAULT 'under_review',
    "justification" TEXT NOT NULL,
    "implementationStatus" TEXT NOT NULL DEFAULT 'planned',
    "controlImplementationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "soa_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soa_approvals" (
    "id" TEXT NOT NULL,
    "soaId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soa_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_knowledge_time_changes" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "oldKnowledgeTime" TIMESTAMP(3) NOT NULL,
    "newKnowledgeTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_knowledge_time_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "recipient" TEXT,
    "submissionMethod" TEXT,
    "submissionProof" TEXT,
    "exportPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_communications" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "incident_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_escalations" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "escalationType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "escalatedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "incident_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'supports',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_acknowledgements" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "document_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_reviews" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_assessments" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentType" TEXT NOT NULL DEFAULT 'initial',
    "questionnaire" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "rating" TEXT NOT NULL DEFAULT 'medium',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "nextAssessmentDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "supplier_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contract_relations" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'primary',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "supplier_contract_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_risk_relations" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'affected_by',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "supplier_risk_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bia_asset_relations" (
    "id" TEXT NOT NULL,
    "biaId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dependency',

    CONSTRAINT "bia_asset_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_continuity_plans" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "biaId" TEXT,
    "ownerId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "scope" TEXT,
    "recoveryStrategies" JSONB NOT NULL DEFAULT '[]',
    "communicationPlan" JSONB NOT NULL DEFAULT '{}',
    "activationCriteria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextTestDate" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_continuity_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcp_exercises" (
    "id" TEXT NOT NULL,
    "bcpId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL DEFAULT 'tabletop',
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "participants" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '{}',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "bcp_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_programs" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "audit_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_plans" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "programId" TEXT,
    "auditType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "auditorIds" JSONB NOT NULL DEFAULT '[]',
    "auditeeIds" JSONB NOT NULL DEFAULT '[]',
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "report" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "audit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_evidence_relations" (
    "id" TEXT NOT NULL,
    "auditFindingId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'supports',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "audit_evidence_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_courses" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'security_awareness',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "validityMonths" INTEGER,
    "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_assignments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "reminderLevel" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_completions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "result" TEXT NOT NULL DEFAULT 'passed',
    "certificateUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "evidenceId" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "training_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_acknowledgements" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "training_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_review_actions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "management_review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_objectives" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "targetValue" DECIMAL(65,30),
    "targetUnit" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "security_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "name" TEXT NOT NULL,
    "metricType" TEXT NOT NULL DEFAULT 'KPI',
    "description" TEXT,
    "unit" TEXT,
    "aggregation" TEXT NOT NULL DEFAULT 'latest',
    "thresholds" JSONB NOT NULL DEFAULT '{}',
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_values" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DECIMAL(65,30) NOT NULL,
    "source" TEXT,
    "comment" TEXT,
    "trend" TEXT,
    "breachStatus" TEXT NOT NULL DEFAULT 'none',
    "breachDetails" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "metric_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "entityType" TEXT NOT NULL,
    "states" JSONB NOT NULL DEFAULT '[]',
    "transitions" JSONB NOT NULL DEFAULT '[]',
    "approvalRules" JSONB NOT NULL DEFAULT '{}',
    "dueDateRules" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_tasks" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'approval',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "decision" TEXT,
    "comment" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_logs" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "transition" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "format" TEXT NOT NULL DEFAULT 'json',
    "schedule" JSONB,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT,
    "module" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "format" TEXT NOT NULL DEFAULT 'json',
    "status" TEXT NOT NULL DEFAULT 'running',
    "result" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'json',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nis2_questionnaire_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "scoringRules" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nis2_questionnaire_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nis2_registration_changes" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changedData" JSONB NOT NULL,
    "notificationDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submissionProof" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nis2_registration_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_accounts" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "accessTokenHash" TEXT NOT NULL,
    "accessTokenSalt" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_audit_logs" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "serviceAccountId" TEXT,
    "userId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestSize" BIGINT NOT NULL DEFAULT 0,
    "responseSize" BIGINT NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "idempotencyKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "serviceAccountId" TEXT NOT NULL,
    "userId" TEXT,
    "httpMethod" TEXT NOT NULL,
    "routePattern" TEXT NOT NULL,
    "requestBodyHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseHeaders" JSONB NOT NULL DEFAULT '{}',
    "responseBodyPreview" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastDeliveryStatus" TEXT,
    "lastDeliveredAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "httpMethod" TEXT NOT NULL DEFAULT 'POST',
    "requestHeaders" JSONB NOT NULL DEFAULT '{}',
    "requestBodyHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseHeaders" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceAccountId" TEXT,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_rate_limits" (
    "id" TEXT NOT NULL,
    "serviceAccountId" TEXT,
    "userId" TEXT,
    "endpointPattern" TEXT NOT NULL DEFAULT '*',
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "requestsPerHour" INTEGER NOT NULL DEFAULT 1000,
    "burstSize" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_scopes" (
    "scope" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_scopes_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "control_catalogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_sources_name_key" ON "integration_sources"("name");

-- CreateIndex
CREATE INDEX "integration_sources_type_idx" ON "integration_sources"("type");

-- CreateIndex
CREATE INDEX "integration_sources_isActive_idx" ON "integration_sources"("isActive");

-- CreateIndex
CREATE INDEX "import_runs_integrationSourceId_idx" ON "import_runs"("integrationSourceId");

-- CreateIndex
CREATE INDEX "import_runs_status_idx" ON "import_runs"("status");

-- CreateIndex
CREATE INDEX "import_runs_startedAt_idx" ON "import_runs"("startedAt");

-- CreateIndex
CREATE INDEX "import_records_targetAssetId_idx" ON "import_records"("targetAssetId");

-- CreateIndex
CREATE INDEX "import_records_status_idx" ON "import_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "import_records_importRunId_sourceRecordId_key" ON "import_records"("importRunId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "import_conflicts_importRunId_idx" ON "import_conflicts"("importRunId");

-- CreateIndex
CREATE INDEX "import_conflicts_assetId_idx" ON "import_conflicts"("assetId");

-- CreateIndex
CREATE INDEX "import_conflicts_status_idx" ON "import_conflicts"("status");

-- CreateIndex
CREATE INDEX "field_provenance_integrationSourceId_idx" ON "field_provenance"("integrationSourceId");

-- CreateIndex
CREATE INDEX "field_provenance_importRunId_idx" ON "field_provenance"("importRunId");

-- CreateIndex
CREATE UNIQUE INDEX "field_provenance_assetId_fieldName_key" ON "field_provenance"("assetId", "fieldName");

-- CreateIndex
CREATE INDEX "field_locks_assetId_idx" ON "field_locks"("assetId");

-- CreateIndex
CREATE INDEX "field_locks_isActive_idx" ON "field_locks"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "field_locks_assetId_fieldName_key" ON "field_locks"("assetId", "fieldName");

-- CreateIndex
CREATE INDEX "source_priorities_fieldName_priority_idx" ON "source_priorities"("fieldName", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "source_priorities_integrationSourceId_fieldName_key" ON "source_priorities"("integrationSourceId", "fieldName");

-- CreateIndex
CREATE INDEX "risk_method_versions_riskMethodId_idx" ON "risk_method_versions"("riskMethodId");

-- CreateIndex
CREATE INDEX "risk_assessments_riskId_isCurrent_idx" ON "risk_assessments"("riskId", "isCurrent");

-- CreateIndex
CREATE INDEX "risk_assessments_riskMethodVersionId_idx" ON "risk_assessments"("riskMethodVersionId");

-- CreateIndex
CREATE INDEX "risk_assessments_assessmentType_idx" ON "risk_assessments"("assessmentType");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_riskId_assessmentNumber_key" ON "risk_assessments"("riskId", "assessmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "risk_acceptances_treatmentId_key" ON "risk_acceptances"("treatmentId");

-- CreateIndex
CREATE INDEX "risk_acceptances_riskId_idx" ON "risk_acceptances"("riskId");

-- CreateIndex
CREATE INDEX "risk_acceptances_assessmentId_idx" ON "risk_acceptances"("assessmentId");

-- CreateIndex
CREATE INDEX "risk_acceptances_status_idx" ON "risk_acceptances"("status");

-- CreateIndex
CREATE INDEX "risk_treatment_approvals_treatmentId_idx" ON "risk_treatment_approvals"("treatmentId");

-- CreateIndex
CREATE INDEX "risk_treatment_approvals_approverId_idx" ON "risk_treatment_approvals"("approverId");

-- CreateIndex
CREATE INDEX "risk_treatment_effectiveness_reviews_treatmentId_idx" ON "risk_treatment_effectiveness_reviews"("treatmentId");

-- CreateIndex
CREATE INDEX "risk_treatment_effectiveness_reviews_reviewerId_idx" ON "risk_treatment_effectiveness_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scenarios_displayId_key" ON "risk_scenarios"("displayId");

-- CreateIndex
CREATE INDEX "risk_scenarios_threatId_idx" ON "risk_scenarios"("threatId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_causes_displayId_key" ON "risk_causes"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_impacts_displayId_key" ON "risk_impacts"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_cause_links_riskId_causeId_key" ON "risk_cause_links"("riskId", "causeId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_impact_links_riskId_impactId_key" ON "risk_impact_links"("riskId", "impactId");

-- CreateIndex
CREATE UNIQUE INDEX "review_tasks_displayId_key" ON "review_tasks"("displayId");

-- CreateIndex
CREATE INDEX "review_tasks_riskId_idx" ON "review_tasks"("riskId");

-- CreateIndex
CREATE INDEX "review_tasks_status_idx" ON "review_tasks"("status");

-- CreateIndex
CREATE INDEX "review_tasks_dueDate_idx" ON "review_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "review_tasks_assignedTo_idx" ON "review_tasks"("assignedTo");

-- CreateIndex
CREATE INDEX "framework_versions_frameworkId_idx" ON "framework_versions"("frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "framework_versions_frameworkId_version_key" ON "framework_versions"("frameworkId", "version");

-- CreateIndex
CREATE INDEX "requirements_frameworkVersionId_idx" ON "requirements"("frameworkVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_frameworkVersionId_requirementKey_key" ON "requirements"("frameworkVersionId", "requirementKey");

-- CreateIndex
CREATE INDEX "control_requirement_mappings_requirementId_idx" ON "control_requirement_mappings"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "control_requirement_mappings_controlId_requirementId_key" ON "control_requirement_mappings"("controlId", "requirementId");

-- CreateIndex
CREATE INDEX "control_implementations_controlId_idx" ON "control_implementations"("controlId");

-- CreateIndex
CREATE INDEX "control_implementations_scopeId_idx" ON "control_implementations"("scopeId");

-- CreateIndex
CREATE INDEX "control_implementations_organizationUnitId_idx" ON "control_implementations"("organizationUnitId");

-- CreateIndex
CREATE INDEX "control_implementations_siteId_idx" ON "control_implementations"("siteId");

-- CreateIndex
CREATE INDEX "control_implementation_requirements_requirementId_idx" ON "control_implementation_requirements"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "control_implementation_requirements_implementationId_requir_key" ON "control_implementation_requirements"("implementationId", "requirementId");

-- CreateIndex
CREATE INDEX "control_findings_implementationId_idx" ON "control_findings"("implementationId");

-- CreateIndex
CREATE INDEX "control_actions_implementationId_idx" ON "control_actions"("implementationId");

-- CreateIndex
CREATE INDEX "control_actions_findingId_idx" ON "control_actions"("findingId");

-- CreateIndex
CREATE INDEX "soa_items_soaId_idx" ON "soa_items"("soaId");

-- CreateIndex
CREATE INDEX "soa_items_requirementId_idx" ON "soa_items"("requirementId");

-- CreateIndex
CREATE INDEX "soa_items_controlId_idx" ON "soa_items"("controlId");

-- CreateIndex
CREATE INDEX "soa_approvals_soaId_idx" ON "soa_approvals"("soaId");

-- CreateIndex
CREATE INDEX "incident_knowledge_time_changes_incidentId_idx" ON "incident_knowledge_time_changes"("incidentId");

-- CreateIndex
CREATE INDEX "incident_reports_incidentId_idx" ON "incident_reports"("incidentId");

-- CreateIndex
CREATE INDEX "incident_reports_reportType_status_idx" ON "incident_reports"("reportType", "status");

-- CreateIndex
CREATE INDEX "incident_communications_incidentId_idx" ON "incident_communications"("incidentId");

-- CreateIndex
CREATE INDEX "incident_escalations_incidentId_status_idx" ON "incident_escalations"("incidentId", "status");

-- CreateIndex
CREATE INDEX "evidence_links_entityType_entityId_idx" ON "evidence_links"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_links_evidenceId_entityType_entityId_key" ON "evidence_links"("evidenceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "document_acknowledgements_userId_idx" ON "document_acknowledgements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_acknowledgements_documentId_versionId_userId_key" ON "document_acknowledgements"("documentId", "versionId", "userId");

-- CreateIndex
CREATE INDEX "document_reviews_documentId_idx" ON "document_reviews"("documentId");

-- CreateIndex
CREATE INDEX "document_reviews_dueDate_idx" ON "document_reviews"("dueDate");

-- CreateIndex
CREATE INDEX "document_reviews_status_idx" ON "document_reviews"("status");

-- CreateIndex
CREATE INDEX "supplier_assessments_supplierId_idx" ON "supplier_assessments"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_assessments_nextAssessmentDate_idx" ON "supplier_assessments"("nextAssessmentDate");

-- CreateIndex
CREATE INDEX "supplier_contract_relations_contractId_idx" ON "supplier_contract_relations"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_contract_relations_supplierId_contractId_key" ON "supplier_contract_relations"("supplierId", "contractId");

-- CreateIndex
CREATE INDEX "supplier_risk_relations_riskId_idx" ON "supplier_risk_relations"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_risk_relations_supplierId_riskId_key" ON "supplier_risk_relations"("supplierId", "riskId");

-- CreateIndex
CREATE INDEX "bia_asset_relations_assetId_idx" ON "bia_asset_relations"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "bia_asset_relations_biaId_assetId_key" ON "bia_asset_relations"("biaId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "business_continuity_plans_displayId_key" ON "business_continuity_plans"("displayId");

-- CreateIndex
CREATE INDEX "business_continuity_plans_biaId_idx" ON "business_continuity_plans"("biaId");

-- CreateIndex
CREATE INDEX "business_continuity_plans_nextTestDate_idx" ON "business_continuity_plans"("nextTestDate");

-- CreateIndex
CREATE INDEX "bcp_exercises_bcpId_idx" ON "bcp_exercises"("bcpId");

-- CreateIndex
CREATE INDEX "bcp_exercises_plannedAt_status_idx" ON "bcp_exercises"("plannedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_programs_displayId_key" ON "audit_programs"("displayId");

-- CreateIndex
CREATE INDEX "audit_programs_year_status_idx" ON "audit_programs"("year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_plans_displayId_key" ON "audit_plans"("displayId");

-- CreateIndex
CREATE INDEX "audit_plans_programId_idx" ON "audit_plans"("programId");

-- CreateIndex
CREATE INDEX "audit_plans_plannedStart_status_idx" ON "audit_plans"("plannedStart", "status");

-- CreateIndex
CREATE INDEX "audit_evidence_relations_evidenceId_idx" ON "audit_evidence_relations"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_evidence_relations_auditFindingId_evidenceId_key" ON "audit_evidence_relations"("auditFindingId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "training_courses_displayId_key" ON "training_courses"("displayId");

-- CreateIndex
CREATE INDEX "training_courses_category_status_idx" ON "training_courses"("category", "status");

-- CreateIndex
CREATE INDEX "training_assignments_userId_status_idx" ON "training_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "training_assignments_dueDate_status_idx" ON "training_assignments"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_assignments_courseId_userId_assignedAt_key" ON "training_assignments"("courseId", "userId", "assignedAt");

-- CreateIndex
CREATE INDEX "training_completions_assignmentId_idx" ON "training_completions"("assignmentId");

-- CreateIndex
CREATE INDEX "training_completions_userId_expiresAt_idx" ON "training_completions"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "training_acknowledgements_courseId_userId_version_key" ON "training_acknowledgements"("courseId", "userId", "version");

-- CreateIndex
CREATE INDEX "management_review_actions_reviewId_idx" ON "management_review_actions"("reviewId");

-- CreateIndex
CREATE INDEX "management_review_actions_dueDate_status_idx" ON "management_review_actions"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "security_objectives_displayId_key" ON "security_objectives"("displayId");

-- CreateIndex
CREATE INDEX "security_objectives_ownerId_status_idx" ON "security_objectives"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_displayId_key" ON "metric_definitions"("displayId");

-- CreateIndex
CREATE INDEX "metric_definitions_objectiveId_idx" ON "metric_definitions"("objectiveId");

-- CreateIndex
CREATE INDEX "metric_definitions_metricType_status_idx" ON "metric_definitions"("metricType", "status");

-- CreateIndex
CREATE INDEX "metric_values_metricId_measuredAt_idx" ON "metric_values"("metricId", "measuredAt");

-- CreateIndex
CREATE INDEX "metric_values_breachStatus_idx" ON "metric_values"("breachStatus");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_displayId_key" ON "workflow_definitions"("displayId");

-- CreateIndex
CREATE INDEX "workflow_definitions_entityType_status_idx" ON "workflow_definitions"("entityType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_name_version_key" ON "workflow_definitions"("name", "version");

-- CreateIndex
CREATE INDEX "workflow_tasks_instanceId_idx" ON "workflow_tasks"("instanceId");

-- CreateIndex
CREATE INDEX "workflow_tasks_assigneeId_status_idx" ON "workflow_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "workflow_tasks_dueDate_status_idx" ON "workflow_tasks"("dueDate", "status");

-- CreateIndex
CREATE INDEX "workflow_transition_logs_instanceId_idx" ON "workflow_transition_logs"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_displayId_key" ON "report_definitions"("displayId");

-- CreateIndex
CREATE INDEX "report_definitions_module_status_idx" ON "report_definitions"("module", "status");

-- CreateIndex
CREATE INDEX "report_runs_definitionId_idx" ON "report_runs"("definitionId");

-- CreateIndex
CREATE INDEX "report_runs_module_startedAt_idx" ON "report_runs"("module", "startedAt");

-- CreateIndex
CREATE INDEX "export_jobs_entityType_requestedAt_idx" ON "export_jobs"("entityType", "requestedAt");

-- CreateIndex
CREATE INDEX "export_jobs_requestedBy_idx" ON "export_jobs"("requestedBy");

-- CreateIndex
CREATE UNIQUE INDEX "nis2_questionnaire_versions_version_key" ON "nis2_questionnaire_versions"("version");

-- CreateIndex
CREATE INDEX "nis2_registration_changes_registrationId_idx" ON "nis2_registration_changes"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "service_accounts_displayId_key" ON "service_accounts"("displayId");

-- CreateIndex
CREATE INDEX "service_accounts_isActive_idx" ON "service_accounts"("isActive");

-- CreateIndex
CREATE INDEX "service_accounts_isArchived_idx" ON "service_accounts"("isArchived");

-- CreateIndex
CREATE INDEX "api_audit_logs_correlationId_idx" ON "api_audit_logs"("correlationId");

-- CreateIndex
CREATE INDEX "api_audit_logs_serviceAccountId_idx" ON "api_audit_logs"("serviceAccountId");

-- CreateIndex
CREATE INDEX "api_audit_logs_createdAt_idx" ON "api_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_serviceAccountId_idx" ON "idempotency_keys"("serviceAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_displayId_key" ON "webhooks"("displayId");

-- CreateIndex
CREATE INDEX "webhooks_isActive_idx" ON "webhooks"("isActive");

-- CreateIndex
CREATE INDEX "webhooks_events_idx" ON "webhooks"("events");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_idx" ON "webhook_deliveries"("webhookId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_eventId_idx" ON "webhook_deliveries"("eventId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_createdAt_idx" ON "webhook_deliveries"("createdAt");

-- CreateIndex
CREATE INDEX "api_rate_limits_serviceAccountId_idx" ON "api_rate_limits"("serviceAccountId");

-- CreateIndex
CREATE INDEX "api_rate_limits_userId_idx" ON "api_rate_limits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "control_catalogs_name_key" ON "control_catalogs"("name");

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
CREATE UNIQUE INDEX "corrective_actions_displayId_key" ON "corrective_actions"("displayId");

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
CREATE INDEX "nis2_registrations_assessmentId_idx" ON "nis2_registrations"("assessmentId");

-- CreateIndex
CREATE INDEX "notification_deadlines_incidentId_idx" ON "notification_deadlines"("incidentId");

-- CreateIndex
CREATE INDEX "notification_deadlines_deadlineDate_status_idx" ON "notification_deadlines"("deadlineDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deadlines_incidentId_notificationType_key" ON "notification_deadlines"("incidentId", "notificationType");

-- CreateIndex
CREATE INDEX "risk_methods_name_version_idx" ON "risk_methods"("name", "version");

-- CreateIndex
CREATE INDEX "risk_treatments_riskId_idx" ON "risk_treatments"("riskId");

-- CreateIndex
CREATE INDEX "risk_treatments_assessmentId_idx" ON "risk_treatments"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "threats_displayId_key" ON "threats"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "vulnerabilities_displayId_key" ON "vulnerabilities"("displayId");

-- CreateIndex
CREATE INDEX "workflow_instances_definitionId_idx" ON "workflow_instances"("definitionId");

-- CreateIndex
CREATE INDEX "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "workflow_instances_dueDate_status_idx" ON "workflow_instances"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "import_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_locks" ADD CONSTRAINT "field_locks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_priorities" ADD CONSTRAINT "source_priorities_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_method_versions" ADD CONSTRAINT "risk_method_versions_riskMethodId_fkey" FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "risk_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_approvals" ADD CONSTRAINT "risk_treatment_approvals_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_effectiveness_reviews" ADD CONSTRAINT "risk_treatment_effectiveness_reviews_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scenarios" ADD CONSTRAINT "risk_scenarios_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scenarios" ADD CONSTRAINT "risk_scenarios_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_cause_links" ADD CONSTRAINT "risk_cause_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_cause_links" ADD CONSTRAINT "risk_cause_links_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "risk_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_impact_links" ADD CONSTRAINT "risk_impact_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_impact_links" ADD CONSTRAINT "risk_impact_links_impactId_fkey" FOREIGN KEY ("impactId") REFERENCES "risk_impacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "framework_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_implementation_requirements" ADD CONSTRAINT "control_implementation_requirements_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_findings" ADD CONSTRAINT "control_findings_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "control_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_approvals" ADD CONSTRAINT "soa_approvals_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deadlines" ADD CONSTRAINT "notification_deadlines_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_knowledge_time_changes" ADD CONSTRAINT "incident_knowledge_time_changes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_escalations" ADD CONSTRAINT "incident_escalations_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acknowledgements" ADD CONSTRAINT "document_acknowledgements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nis2_registrations" ADD CONSTRAINT "nis2_registrations_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "nis2_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nis2_registration_changes" ADD CONSTRAINT "nis2_registration_changes_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "nis2_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_audit_logs" ADD CONSTRAINT "api_audit_logs_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_catalog_items" ADD CONSTRAINT "control_catalog_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "control_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "control_catalog_items_catalogId_controlId_unique" RENAME TO "control_catalog_items_catalogId_controlId_key";
