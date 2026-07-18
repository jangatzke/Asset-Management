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
    "oidcId" TEXT,
    "oidcProvider" TEXT,
    "language" TEXT DEFAULT 'en',
    "darkMode" BOOLEAN,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleId" TEXT,
    "organizationUnitId" TEXT,
    "scopeId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false,
    "entityPermissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_roles" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oidc_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "providerName" TEXT NOT NULL DEFAULT 'entra_id',
    "tenantId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "redirectUri" TEXT,
    "allowedEmailDomains" JSONB NOT NULL,
    "autoProvisioning" BOOLEAN NOT NULL DEFAULT false,
    "defaultRoleForNewUsers" TEXT NOT NULL DEFAULT 'employee',
    "enableGroupMapping" BOOLEAN NOT NULL DEFAULT false,
    "groupClaimToRoleMapping" JSONB NOT NULL,
    "enableLocalLogin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oidc_configs_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "country" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "business_services" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceOwner" TEXT,
    "category" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
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
    "licenseInfo" TEXT,
    "contractEndsAt" TIMESTAMP(3),
    "licenseExpiresAt" TIMESTAMP(3),
    "personnelSafetyRelevance" TEXT NOT NULL DEFAULT 'low',
    "regulatoryRelevance" TEXT NOT NULL DEFAULT 'low',
    "financialDamagePotential" TEXT NOT NULL DEFAULT 'low',
    "productionDowntimeImpact" TEXT NOT NULL DEFAULT 'low',
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
CREATE TABLE "network_addresses" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_methods" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "likelihoodScale" JSONB NOT NULL,
    "impactScale" JSONB NOT NULL,
    "ratingDimensions" JSONB NOT NULL,
    "formula" TEXT NOT NULL,
    "riskClasses" JSONB NOT NULL,
    "acceptanceThresholds" JSONB,
    "escalationThresholds" JSONB,
    "approvalRules" JSONB,
    "reviewInterval" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizationUnitId" TEXT,
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
    "businessProcessId" TEXT,
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
CREATE TABLE "risk_treatments" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "treatmentOption" TEXT NOT NULL,
    "plannedActions" TEXT,
    "responsibleUserId" TEXT,
    "budget" DECIMAL(65,30),
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
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
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
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "display_id_counters" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_id_counters_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "intune_device_syncs" (
    "id" TEXT NOT NULL,
    "intuneId" TEXT NOT NULL,
    "name" TEXT,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "osName" TEXT,
    "osVersion" TEXT,
    "deviceEnrollmentType" TEXT,
    "managementType" TEXT,
    "complianceStatus" TEXT,
    "deviceState" TEXT,
    "enrollmentDateTime" TIMESTAMP(3),
    "lastSyncDateTime" TIMESTAMP(3),
    "primaryUserEmail" TEXT,
    "primaryUserDisplayName" TEXT,
    "endpointSecurityStatus" JSONB,
    "malwareStatus" JSONB,
    "compliancePolicyName" TEXT,
    "configurationPolicyName" TEXT,
    "autopilotStatus" TEXT,
    "autopilotProfileName" TEXT,
    "lastSeenDateTime" TIMESTAMP(3),
    "intuneLicenseState" TEXT,
    "deviceWpdsStatus" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorMessage" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "assetId" TEXT,
    "sourceIntuneId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intune_device_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intune_detected_apps" (
    "id" TEXT NOT NULL,
    "intuneAppId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT,
    "version" TEXT,
    "publisher" TEXT,
    "platform" TEXT,
    "appCategory" TEXT,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncErrorMessage" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "sourceIntuneId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intune_detected_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intune_sync_status" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "deviceCount" INTEGER NOT NULL DEFAULT 0,
    "deviceSynced" INTEGER NOT NULL DEFAULT 0,
    "deviceErrors" INTEGER NOT NULL DEFAULT 0,
    "appCount" INTEGER NOT NULL DEFAULT 0,
    "appSynced" INTEGER NOT NULL DEFAULT 0,
    "appErrors" INTEGER NOT NULL DEFAULT 0,
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncCompletedAt" TIMESTAMP(3),
    "lastSyncDurationMs" INTEGER,
    "lastError" TEXT,
    "totalSyncs" INTEGER NOT NULL DEFAULT 0,
    "totalDevicesSynced" INTEGER NOT NULL DEFAULT 0,
    "totalDevicesErrors" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'healthy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intune_sync_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intune_sync_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fullSyncIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "incrementalSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 120,
    "gracePeriodHours" INTEGER NOT NULL DEFAULT 168,
    "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "batchSize" INTEGER NOT NULL DEFAULT 100,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastIncrementalSyncAt" TIMESTAMP(3),
    "nextFullSyncAt" TIMESTAMP(3),
    "nextIncrementalSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intune_sync_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intune_app_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Intune API Credentials',
    "tenantId" TEXT,
    "appId" TEXT,
    "clientSecret" TEXT,
    "clientSecretExpiresAt" TIMESTAMP(3),
    "certificateThumbprint" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intune_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contractType" TEXT NOT NULL,
    "supplierId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "value" DECIMAL(65,30),
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "licenseType" TEXT NOT NULL,
    "vendor" TEXT,
    "productId" TEXT,
    "licenseKey" TEXT,
    "seats" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "cost" DECIMAL(65,30),
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_processes" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processOwner" TEXT NOT NULL,
    "category" TEXT,
    "siacControlled" BOOLEAN NOT NULL DEFAULT false,
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_documents" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_evidence" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "risk_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assets" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "risk_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerability_assets" (
    "id" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "vulnerability_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_assets" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "incident_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_processes" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "asset_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_services" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "asset_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_contracts" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,

    CONSTRAINT "asset_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_licenses" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,

    CONSTRAINT "asset_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_licenses" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,

    CONSTRAINT "contract_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_processes" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "risk_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_services" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "risk_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_services" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "incident_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_processes" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "incident_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_assets" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "control_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_processes" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "control_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_sites" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "control_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_lifecycle_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "disposalEvidence" TEXT,

    CONSTRAINT "asset_lifecycle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vmware_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vmware_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vcenter_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 443,
    "credentialId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "vmCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vcenter_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxmox_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT,
    "apiToken" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxmox_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxmox_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8006,
    "nodeId" TEXT,
    "credentialId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "vmCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxmox_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssetRisks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AssetControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_RiskControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_displayId_key" ON "users"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_oidcId_oidcProvider_idx" ON "users"("oidcId", "oidcProvider");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_userId_groupId_key" ON "user_groups"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_name_key" ON "asset_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_services_displayId_key" ON "business_services"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_displayId_key" ON "assets"("displayId");

-- CreateIndex
CREATE INDEX "network_addresses_assetId_idx" ON "network_addresses"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_methods_displayId_key" ON "risk_methods"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risks_displayId_key" ON "risks"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_treatments_displayId_key" ON "risk_treatments"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_displayId_key" ON "documents"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "frameworks_code_key" ON "frameworks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_displayId_key" ON "incidents"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_assessments_incidentId_key" ON "incident_assessments"("incidentId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "display_id_counters_entityType_key" ON "display_id_counters"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "intune_device_syncs_intuneId_key" ON "intune_device_syncs"("intuneId");

-- CreateIndex
CREATE UNIQUE INDEX "intune_device_syncs_assetId_key" ON "intune_device_syncs"("assetId");

-- CreateIndex
CREATE INDEX "intune_device_syncs_intuneId_idx" ON "intune_device_syncs"("intuneId");

-- CreateIndex
CREATE INDEX "intune_device_syncs_syncStatus_idx" ON "intune_device_syncs"("syncStatus");

-- CreateIndex
CREATE INDEX "intune_device_syncs_lastSyncDateTime_idx" ON "intune_device_syncs"("lastSyncDateTime");

-- CreateIndex
CREATE INDEX "intune_detected_apps_intuneAppId_idx" ON "intune_detected_apps"("intuneAppId");

-- CreateIndex
CREATE INDEX "intune_detected_apps_deviceId_idx" ON "intune_detected_apps"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "intune_detected_apps_intuneAppId_deviceId_key" ON "intune_detected_apps"("intuneAppId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_displayId_key" ON "contracts"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_displayId_key" ON "licenses"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "business_processes_displayId_key" ON "business_processes"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_documents_assetId_documentId_key" ON "asset_documents"("assetId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_evidence_riskId_evidenceId_key" ON "risk_evidence"("riskId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assets_riskId_assetId_key" ON "risk_assets"("riskId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "vulnerability_assets_vulnerabilityId_assetId_key" ON "vulnerability_assets"("vulnerabilityId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_assets_incidentId_assetId_key" ON "incident_assets"("incidentId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_processes_assetId_processId_key" ON "asset_processes"("assetId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_services_assetId_serviceId_key" ON "asset_services"("assetId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_contracts_assetId_contractId_key" ON "asset_contracts"("assetId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_licenses_assetId_licenseId_key" ON "asset_licenses"("assetId", "licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_licenses_contractId_licenseId_key" ON "contract_licenses"("contractId", "licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_processes_riskId_processId_key" ON "risk_processes"("riskId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_services_riskId_serviceId_key" ON "risk_services"("riskId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_services_incidentId_serviceId_key" ON "incident_services"("incidentId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_processes_incidentId_processId_key" ON "incident_processes"("incidentId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "control_assets_controlId_assetId_key" ON "control_assets"("controlId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "control_processes_controlId_processId_key" ON "control_processes"("controlId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "control_sites_controlId_siteId_key" ON "control_sites"("controlId", "siteId");

-- CreateIndex
CREATE INDEX "vcenter_servers_credentialId_idx" ON "vcenter_servers"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "vcenter_servers_host_port_key" ON "vcenter_servers"("host", "port");

-- CreateIndex
CREATE INDEX "proxmox_servers_credentialId_idx" ON "proxmox_servers"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "proxmox_servers_host_port_nodeId_key" ON "proxmox_servers"("host", "port", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "_AssetRisks_AB_unique" ON "_AssetRisks"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetRisks_B_index" ON "_AssetRisks"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AssetControls_AB_unique" ON "_AssetControls"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetControls_B_index" ON "_AssetControls"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RiskControls_AB_unique" ON "_RiskControls"("A", "B");

-- CreateIndex
CREATE INDEX "_RiskControls_B_index" ON "_RiskControls"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_addresses" ADD CONSTRAINT "network_addresses_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_businessProcessId_fkey" FOREIGN KEY ("businessProcessId") REFERENCES "business_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatments" ADD CONSTRAINT "risk_treatments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assets" ADD CONSTRAINT "risk_assets_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assets" ADD CONSTRAINT "risk_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assets" ADD CONSTRAINT "incident_assets_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assets" ADD CONSTRAINT "incident_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_processes" ADD CONSTRAINT "asset_processes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_processes" ADD CONSTRAINT "asset_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_services" ADD CONSTRAINT "asset_services_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_services" ADD CONSTRAINT "asset_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_contracts" ADD CONSTRAINT "asset_contracts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_contracts" ADD CONSTRAINT "asset_contracts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_licenses" ADD CONSTRAINT "contract_licenses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_licenses" ADD CONSTRAINT "contract_licenses_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_processes" ADD CONSTRAINT "risk_processes_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_processes" ADD CONSTRAINT "risk_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_services" ADD CONSTRAINT "risk_services_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_services" ADD CONSTRAINT "risk_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_processes" ADD CONSTRAINT "incident_processes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_processes" ADD CONSTRAINT "incident_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assets" ADD CONSTRAINT "control_assets_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assets" ADD CONSTRAINT "control_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_processes" ADD CONSTRAINT "control_processes_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_processes" ADD CONSTRAINT "control_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_sites" ADD CONSTRAINT "control_sites_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_sites" ADD CONSTRAINT "control_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcenter_servers" ADD CONSTRAINT "vcenter_servers_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "vmware_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxmox_servers" ADD CONSTRAINT "proxmox_servers_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "proxmox_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_B_fkey" FOREIGN KEY ("B") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_A_fkey" FOREIGN KEY ("A") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
