-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePasswordOnNext" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationUnitId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "scopeId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'department',
    "legalEntityId" TEXT,
    "responsibleUserId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isms_scopes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "includedCompanies" JSONB NOT NULL,
    "includedLocations" JSONB NOT NULL,
    "includedBusinessProcesses" JSONB NOT NULL,
    "includedServices" JSONB NOT NULL,
    "includedAssets" JSONB NOT NULL,
    "explicitExclusions" JSONB NOT NULL,
    "exclusionJustifications" JSONB NOT NULL,
    "responsibleUserId" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "isms_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interested_parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requirements" JSONB,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "interested_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetTypeId" TEXT NOT NULL,
    "subType" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "externalId" TEXT,
    "organizationUnitId" TEXT,
    "locationId" TEXT,
    "technicalOperatorId" TEXT,
    "businessOwnerId" TEXT,
    "informationSecurityResponsibleId" TEXT,
    "businessProcessId" TEXT,
    "serviceId" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'planned',
    "purchaseDate" TIMESTAMP(3),
    "commissioningDate" TIMESTAMP(3),
    "endOfSaleDate" TIMESTAMP(3),
    "endOfLifeDate" TIMESTAMP(3),
    "endOfSupportDate" TIMESTAMP(3),
    "confidentialityNeed" TEXT NOT NULL DEFAULT 'low',
    "integrityNeed" TEXT NOT NULL DEFAULT 'low',
    "availabilityNeed" TEXT NOT NULL DEFAULT 'low',
    "dataProtectionRelevance" BOOLEAN NOT NULL DEFAULT false,
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "networkAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dnsNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataSource" TEXT,
    "lastDetectedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_relations" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetAssetId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "asset_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "likelihoodScale" JSONB NOT NULL,
    "impactScale" JSONB NOT NULL,
    "evaluationDimensions" JSONB NOT NULL,
    "calculationFormula" TEXT NOT NULL,
    "riskClasses" JSONB NOT NULL,
    "acceptanceThresholds" JSONB NOT NULL,
    "escalationThresholds" JSONB NOT NULL,
    "approvalRules" JSONB NOT NULL,
    "reviewIntervals" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risk_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "affectedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedProcessIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "threatId" TEXT,
    "vulnerabilityId" TEXT,
    "possibleImpact" TEXT NOT NULL,
    "existingControls" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_treatment_plans" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "treatmentOption" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "budget" DECIMAL(65,30),
    "targetDate" TIMESTAMP(3) NOT NULL,
    "expectedRiskReduction" TEXT NOT NULL,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "implementationStatus" TEXT NOT NULL DEFAULT 'not_started',
    "effectivenessReview" TEXT,
    "completionApproval" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risk_treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_actions" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "expectedOutcome" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "treatment_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "cveId" TEXT,
    "cvssScore" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frameworks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "publisher" TEXT,
    "publicationDate" TIMESTAMP(3),
    "licenseInfo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "controlGoal" TEXT NOT NULL,
    "responsibleId" TEXT,
    "applicability" TEXT NOT NULL DEFAULT 'under_review',
    "applicabilityJustification" TEXT,
    "implementationStatus" TEXT NOT NULL DEFAULT 'planned',
    "maturityLevel" INTEGER NOT NULL DEFAULT 0,
    "implementationDescription" TEXT,
    "affectedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedProcessIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedSiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedRiskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "testMethod" TEXT,
    "testFrequency" TEXT,
    "lastEffectivenessReview" TIMESTAMP(3),
    "nextTestDate" TIMESTAMP(3),
    "findings" TEXT,
    "actions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements_of_applicability" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "frameworkVersion" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "controls" JSONB NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "statements_of_applicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectionTime" TIMESTAMP(3) NOT NULL,
    "knowledgeTime" TIMESTAMP(3) NOT NULL,
    "reporterId" TEXT,
    "reporterSource" TEXT,
    "affectedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedProcessIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidentialityImpact" TEXT NOT NULL DEFAULT 'none',
    "integrityImpact" TEXT NOT NULL DEFAULT 'none',
    "availabilityImpact" TEXT NOT NULL DEFAULT 'none',
    "operationalImpact" TEXT,
    "financialImpact" DECIMAL(65,30),
    "legalImpact" TEXT,
    "personalDataImpact" BOOLEAN NOT NULL DEFAULT false,
    "affectedCustomers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedThirdParties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suspectedCause" TEXT,
    "isIntentional" BOOLEAN,
    "hasCrossBorderImpact" BOOLEAN,
    "indicatorsOfCompromise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "immediateActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "incidentManagerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "severity" TEXT NOT NULL DEFAULT 'low',
    "notificationStatus" TEXT NOT NULL DEFAULT 'not_required',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_assessments" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "isReportable" BOOLEAN NOT NULL DEFAULT false,
    "reportingJustification" TEXT,
    "decisionNotToReport" TEXT,
    "decisionApprovedBy" TEXT,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "incident_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deadlines" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "knowledgeTimeReference" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "submissionProof" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidenceType" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "classification" TEXT,
    "responsibleId" TEXT NOT NULL,
    "relatedControlIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedRiskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileHash" TEXT,
    "retentionPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "origin" TEXT,
    "correlationId" TEXT,
    "justification" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT NOT NULL,
    "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "ownerId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "content" TEXT NOT NULL,
    "changeLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "productsAndServices" TEXT,
    "supportedBusinessProcesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedAssets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processedDataTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessMethods" TEXT,
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subcontractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contractPeriod" TEXT,
    "exitRules" TEXT,
    "securityRequirements" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "riskAssessment" TEXT,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_impact_analyses" (
    "id" TEXT NOT NULL,
    "businessProcessOrService" TEXT NOT NULL,
    "processOwnerId" TEXT NOT NULL,
    "timeDependentImpacts" JSONB NOT NULL,
    "maximumTolerablePause" INTEGER,
    "recoveryTimeObjective" INTEGER,
    "recoveryPointObjective" INTEGER,
    "minimumOperatingLevel" TEXT,
    "requiredPersonnel" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependentAssets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependentSuppliers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependentCommunication" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergencyProcedures" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "auditorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "independenceConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "dates" JSONB NOT NULL,
    "interviewees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "samples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "findings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "report" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'planned',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedRequirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedControlIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedRiskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctiveActionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "implementationStatus" TEXT NOT NULL DEFAULT 'not_started',
    "effectivenessReview" TEXT,
    "rootCause" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetGroup" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "repeatInterval" TEXT,
    "executionDate" TIMESTAMP(3),
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result" TEXT,
    "certificate" TEXT,
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_reviews" (
    "id" TEXT NOT NULL,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date" TIMESTAMP(3) NOT NULL,
    "previousActionsStatus" TEXT,
    "contextChanges" TEXT,
    "securityGoals" TEXT,
    "kpis" TEXT,
    "auditResults" TEXT,
    "incidentSummary" TEXT,
    "riskDevelopment" TEXT,
    "correctiveActionsStatus" TEXT,
    "resourceNeeds" TEXT,
    "managementDecisions" TEXT,
    "newActions" TEXT,
    "newResponsibilities" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "management_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nis2_assessments" (
    "id" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "assessmentType" TEXT NOT NULL DEFAULT 'applicability',
    "result" TEXT,
    "justification" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "nis2_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nis2_registrations" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "contactPerson" TEXT,
    "contactDetails" TEXT,
    "submittedData" JSONB,
    "submissionProof" TEXT,
    "bsiConfirmation" TEXT,
    "changeNotifications" JSONB,
    "lastReviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "nis2_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "definition" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_displayId_key" ON "users"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_name_key" ON "asset_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assets_displayId_key" ON "assets"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risks_displayId_key" ON "risks"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_treatment_plans_riskId_key" ON "risk_treatment_plans"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "frameworks_code_key" ON "frameworks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_displayId_key" ON "incidents"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_assessments_incidentId_key" ON "incident_assessments"("incidentId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_objectId_objectType_idx" ON "audit_logs"("objectId", "objectType");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_actions" ADD CONSTRAINT "treatment_actions_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "risk_treatment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
