-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
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
CREATE TABLE IF NOT EXISTS "user_roles" (
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
CREATE TABLE IF NOT EXISTS "roles" (
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
CREATE TABLE IF NOT EXISTS "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "group_roles" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oidc_configs" (
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
CREATE TABLE IF NOT EXISTS "organization_units" (
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
CREATE TABLE IF NOT EXISTS "legal_entities" (
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
CREATE TABLE IF NOT EXISTS "sites" (
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
CREATE TABLE IF NOT EXISTS "isms_scopes" (
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
CREATE TABLE IF NOT EXISTS "interested_parties" (
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
CREATE TABLE IF NOT EXISTS "asset_types" (
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
CREATE TABLE IF NOT EXISTS "business_services" (
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
CREATE TABLE IF NOT EXISTS "assets" (
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
    "complianceRelevance" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "disposalDate" TIMESTAMP(3),
    "disposalMethod" TEXT,
    "disposalResponsible" TEXT,
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
CREATE TABLE IF NOT EXISTS "asset_relations" (
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
CREATE TABLE IF NOT EXISTS "network_addresses" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_sources" (
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
CREATE TABLE IF NOT EXISTS "import_runs" (
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
CREATE TABLE IF NOT EXISTS "import_records" (
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
CREATE TABLE IF NOT EXISTS "import_conflicts" (
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
CREATE TABLE IF NOT EXISTS "field_provenance" (
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
CREATE TABLE IF NOT EXISTS "field_locks" (
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
CREATE TABLE IF NOT EXISTS "source_priorities" (
    "id" TEXT NOT NULL,
    "integrationSourceId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_methods" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_method_versions" (
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
CREATE TABLE IF NOT EXISTS "risks" (
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
    "riskMethodVersionId" TEXT,
    "scenarioId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_assessments" (
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
CREATE TABLE IF NOT EXISTS "risk_treatments" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "assessmentId" TEXT,
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
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "residualAssessmentId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_acceptances" (
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
CREATE TABLE IF NOT EXISTS "risk_treatment_approvals" (
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
CREATE TABLE IF NOT EXISTS "risk_treatment_effectiveness_reviews" (
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
CREATE TABLE IF NOT EXISTS "threats" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS "vulnerabilities" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS "risk_scenarios" (
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
CREATE TABLE IF NOT EXISTS "risk_causes" (
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
CREATE TABLE IF NOT EXISTS "risk_impacts" (
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
CREATE TABLE IF NOT EXISTS "risk_cause_links" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,

    CONSTRAINT "risk_cause_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_impact_links" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "impactId" TEXT NOT NULL,

    CONSTRAINT "risk_impact_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "review_tasks" (
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
CREATE TABLE IF NOT EXISTS "documents" (
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
    "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "reviewIntervalDays" INTEGER,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "frameworks" (
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
CREATE TABLE IF NOT EXISTS "framework_versions" (
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
CREATE TABLE IF NOT EXISTS "requirements" (
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
CREATE TABLE IF NOT EXISTS "control_requirement_mappings" (
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
CREATE TABLE IF NOT EXISTS "controls" (
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
CREATE TABLE IF NOT EXISTS "control_implementations" (
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
CREATE TABLE IF NOT EXISTS "control_implementation_requirements" (
    "id" TEXT NOT NULL,
    "implementationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,

    CONSTRAINT "control_implementation_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "control_findings" (
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
CREATE TABLE IF NOT EXISTS "control_actions" (
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
CREATE TABLE IF NOT EXISTS "statements_of_applicability" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "frameworkVersion" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "controls" JSONB,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "statements_of_applicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "soa_items" (
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
CREATE TABLE IF NOT EXISTS "soa_approvals" (
    "id" TEXT NOT NULL,
    "soaId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soa_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incidents" (
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
    "significanceRuleVersionId" TEXT,
    "isSignificant" BOOLEAN NOT NULL DEFAULT false,
    "significanceReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rootCause" TEXT,
    "lessonsLearned" TEXT,
    "measuresEvaluation" TEXT,
    "closureSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incident_assessments" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "isReportable" BOOLEAN NOT NULL DEFAULT false,
    "reportingJustification" TEXT,
    "decisionNotToReport" TEXT,
    "decisionApprovedBy" TEXT,
    "decisionApprovedAt" TIMESTAMP(3),
    "significanceRuleVersionId" TEXT,
    "evaluatedRules" JSONB,
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
CREATE TABLE IF NOT EXISTS "notification_deadlines" (
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
CREATE TABLE IF NOT EXISTS "incident_knowledge_time_changes" (
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
CREATE TABLE IF NOT EXISTS "incident_reports" (
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
CREATE TABLE IF NOT EXISTS "incident_communications" (
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
CREATE TABLE IF NOT EXISTS "incident_escalations" (
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
CREATE TABLE IF NOT EXISTS "evidence" (
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
    "relatedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedSoAItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileHash" TEXT,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "retentionPeriod" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deleteProtected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "evidence_links" (
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
CREATE TABLE IF NOT EXISTS "audit_logs" (
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
CREATE TABLE IF NOT EXISTS "display_id_counters" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_id_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "policy_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT NOT NULL,
    "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "ownerId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "reviewIntervalDays" INTEGER,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE IF NOT EXISTS "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "content" TEXT NOT NULL,
    "changeLog" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_acknowledgements" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "document_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_reviews" (
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
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "description" TEXT,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "servicesProvided" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "dataProtectionRelevant" BOOLEAN NOT NULL DEFAULT false,
    "nis2Relevant" BOOLEAN NOT NULL DEFAULT false,
    "securityRequirements" JSONB NOT NULL DEFAULT '{}',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "exitStrategy" TEXT,
    "assessmentScore" INTEGER,
    "assessmentRating" TEXT,
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
CREATE TABLE IF NOT EXISTS "supplier_assessments" (
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
CREATE TABLE IF NOT EXISTS "supplier_contract_relations" (
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
CREATE TABLE IF NOT EXISTS "supplier_risk_relations" (
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
CREATE TABLE IF NOT EXISTS "business_impact_analyses" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "processId" TEXT,
    "serviceId" TEXT,
    "ownerId" TEXT NOT NULL,
    "mtpdMinutes" INTEGER NOT NULL,
    "rtoMinutes" INTEGER NOT NULL,
    "rpoMinutes" INTEGER NOT NULL,
    "impactCategories" JSONB NOT NULL DEFAULT '[]',
    "timeDependentImpacts" JSONB NOT NULL DEFAULT '{}',
    "minimumOperatingLevel" TEXT,
    "requiredResources" JSONB NOT NULL DEFAULT '{}',
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "business_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bia_asset_relations" (
    "id" TEXT NOT NULL,
    "biaId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dependency',

    CONSTRAINT "bia_asset_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "business_continuity_plans" (
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
CREATE TABLE IF NOT EXISTS "bcp_exercises" (
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
CREATE TABLE IF NOT EXISTS "audit_programs" (
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
CREATE TABLE IF NOT EXISTS "audit_plans" (
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
CREATE TABLE IF NOT EXISTS "audit_findings" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "findingType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirementIds" JSONB NOT NULL DEFAULT '[]',
    "controlIds" JSONB NOT NULL DEFAULT '[]',
    "assetIds" JSONB NOT NULL DEFAULT '[]',
    "riskIds" JSONB NOT NULL DEFAULT '[]',
    "correctiveActionId" TEXT,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_evidence_relations" (
    "id" TEXT NOT NULL,
    "auditFindingId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'supports',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "audit_evidence_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "corrective_actions" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "rootCause" TEXT,
    "containmentActions" JSONB NOT NULL DEFAULT '[]',
    "correctiveActions" JSONB NOT NULL DEFAULT '[]',
    "effectivenessCriteria" TEXT,
    "effectivenessReview" TEXT,
    "effectivenessStatus" TEXT,
    "effectivenessReviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "training_courses" (
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
CREATE TABLE IF NOT EXISTS "training_assignments" (
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
CREATE TABLE IF NOT EXISTS "training_completions" (
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
CREATE TABLE IF NOT EXISTS "training_acknowledgements" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "training_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "management_reviews" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "chairId" TEXT NOT NULL,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "decisions" JSONB NOT NULL DEFAULT '[]',
    "minutes" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "management_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "management_review_actions" (
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
CREATE TABLE IF NOT EXISTS "security_objectives" (
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
CREATE TABLE IF NOT EXISTS "metric_definitions" (
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
CREATE TABLE IF NOT EXISTS "metric_values" (
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
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
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
CREATE TABLE IF NOT EXISTS "workflow_instances" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "context" JSONB NOT NULL DEFAULT '{}',
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow_tasks" (
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
CREATE TABLE IF NOT EXISTS "workflow_transition_logs" (
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
CREATE TABLE IF NOT EXISTS "report_definitions" (
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
CREATE TABLE IF NOT EXISTS "report_runs" (
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
CREATE TABLE IF NOT EXISTS "export_jobs" (
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
CREATE TABLE IF NOT EXISTS "nis2_assessments" (
    "id" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "assessmentType" TEXT NOT NULL DEFAULT 'applicability',
    "questionnaireVersion" TEXT NOT NULL DEFAULT '1.0',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "preliminaryResult" TEXT,
    "preliminaryJustification" TEXT,
    "result" TEXT,
    "justification" TEXT,
    "submittedForApprovalAt" TIMESTAMP(3),
    "submittedForApprovalBy" TEXT,
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
CREATE TABLE IF NOT EXISTS "nis2_registrations" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT,
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
CREATE TABLE IF NOT EXISTS "nis2_questionnaire_versions" (
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
CREATE TABLE IF NOT EXISTS "nis2_registration_changes" (
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
CREATE TABLE IF NOT EXISTS "nis2_incident_significance_rule_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nis2_incident_significance_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "intune_device_syncs" (
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
CREATE TABLE IF NOT EXISTS "intune_detected_apps" (
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
CREATE TABLE IF NOT EXISTS "intune_sync_status" (
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
CREATE TABLE IF NOT EXISTS "intune_sync_config" (
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
CREATE TABLE IF NOT EXISTS "intune_app_credentials" (
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
CREATE TABLE IF NOT EXISTS "contracts" (
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
CREATE TABLE IF NOT EXISTS "licenses" (
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
CREATE TABLE IF NOT EXISTS "business_processes" (
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
CREATE TABLE IF NOT EXISTS "asset_documents" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_evidence" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "risk_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_assets" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "risk_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vulnerability_assets" (
    "id" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "vulnerability_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incident_assets" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "incident_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_processes" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "asset_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_services" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "asset_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_contracts" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,

    CONSTRAINT "asset_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_licenses" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,

    CONSTRAINT "asset_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contract_licenses" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,

    CONSTRAINT "contract_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_processes" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "risk_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_services" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "risk_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incident_services" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "incident_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incident_processes" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "incident_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "control_assets" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "control_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "control_processes" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "control_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "control_sites" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "control_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_lifecycle_logs" (
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
CREATE TABLE IF NOT EXISTS "vmware_credentials" (
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
CREATE TABLE IF NOT EXISTS "vcenter_servers" (
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
CREATE TABLE IF NOT EXISTS "proxmox_credentials" (
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
CREATE TABLE IF NOT EXISTS "proxmox_servers" (
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
CREATE TABLE IF NOT EXISTS "_AssetRisks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssetControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_RiskControls" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_displayId_key" ON "users"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "users_oidcId_oidcProvider_idx" ON "users"("oidcId", "oidcProvider");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "groups_name_key" ON "groups"("name");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_groups_userId_groupId_key" ON "user_groups"("userId", "groupId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_types_name_key" ON "asset_types"("name");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "business_services_displayId_key" ON "business_services"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "assets_displayId_key" ON "assets"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "network_addresses_assetId_idx" ON "network_addresses"("assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "integration_sources_name_key" ON "integration_sources"("name");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "integration_sources_type_idx" ON "integration_sources"("type");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "integration_sources_isActive_idx" ON "integration_sources"("isActive");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_runs_integrationSourceId_idx" ON "import_runs"("integrationSourceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_runs_status_idx" ON "import_runs"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_runs_startedAt_idx" ON "import_runs"("startedAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_records_targetAssetId_idx" ON "import_records"("targetAssetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_records_status_idx" ON "import_records"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "import_records_importRunId_sourceRecordId_key" ON "import_records"("importRunId", "sourceRecordId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_conflicts_importRunId_idx" ON "import_conflicts"("importRunId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_conflicts_assetId_idx" ON "import_conflicts"("assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "import_conflicts_status_idx" ON "import_conflicts"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "field_provenance_integrationSourceId_idx" ON "field_provenance"("integrationSourceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "field_provenance_importRunId_idx" ON "field_provenance"("importRunId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "field_provenance_assetId_fieldName_key" ON "field_provenance"("assetId", "fieldName");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "field_locks_assetId_idx" ON "field_locks"("assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "field_locks_isActive_idx" ON "field_locks"("isActive");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "field_locks_assetId_fieldName_key" ON "field_locks"("assetId", "fieldName");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "source_priorities_fieldName_priority_idx" ON "source_priorities"("fieldName", "priority");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "source_priorities_integrationSourceId_fieldName_key" ON "source_priorities"("integrationSourceId", "fieldName");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_methods_displayId_key" ON "risk_methods"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_methods_name_version_idx" ON "risk_methods"("name", "version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_method_versions_riskMethodId_idx" ON "risk_method_versions"("riskMethodId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risks_displayId_key" ON "risks"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risks_riskMethodVersionId_idx" ON "risks"("riskMethodVersionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risks_scenarioId_idx" ON "risks"("scenarioId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_assessments_riskId_isCurrent_idx" ON "risk_assessments"("riskId", "isCurrent");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_assessments_riskMethodVersionId_idx" ON "risk_assessments"("riskMethodVersionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_assessments_assessmentType_idx" ON "risk_assessments"("assessmentType");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessments_riskId_assessmentNumber_key" ON "risk_assessments"("riskId", "assessmentNumber");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_treatments_displayId_key" ON "risk_treatments"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatments_riskId_idx" ON "risk_treatments"("riskId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatments_assessmentId_idx" ON "risk_treatments"("assessmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_acceptances_treatmentId_key" ON "risk_acceptances"("treatmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_acceptances_riskId_idx" ON "risk_acceptances"("riskId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_acceptances_assessmentId_idx" ON "risk_acceptances"("assessmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_acceptances_status_idx" ON "risk_acceptances"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatment_approvals_treatmentId_idx" ON "risk_treatment_approvals"("treatmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatment_approvals_approverId_idx" ON "risk_treatment_approvals"("approverId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatment_effectiveness_reviews_treatmentId_idx" ON "risk_treatment_effectiveness_reviews"("treatmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_treatment_effectiveness_reviews_reviewerId_idx" ON "risk_treatment_effectiveness_reviews"("reviewerId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "threats_displayId_key" ON "threats"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "vulnerabilities_displayId_key" ON "vulnerabilities"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_scenarios_displayId_key" ON "risk_scenarios"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "risk_scenarios_threatId_idx" ON "risk_scenarios"("threatId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_causes_displayId_key" ON "risk_causes"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_impacts_displayId_key" ON "risk_impacts"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_cause_links_riskId_causeId_key" ON "risk_cause_links"("riskId", "causeId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_impact_links_riskId_impactId_key" ON "risk_impact_links"("riskId", "impactId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "review_tasks_displayId_key" ON "review_tasks"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "review_tasks_riskId_idx" ON "review_tasks"("riskId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "review_tasks_status_idx" ON "review_tasks"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "review_tasks_dueDate_idx" ON "review_tasks"("dueDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "review_tasks_assignedTo_idx" ON "review_tasks"("assignedTo");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "documents_displayId_key" ON "documents"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "frameworks_code_key" ON "frameworks"("code");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "framework_versions_frameworkId_idx" ON "framework_versions"("frameworkId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "framework_versions_frameworkId_version_key" ON "framework_versions"("frameworkId", "version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "requirements_frameworkVersionId_idx" ON "requirements"("frameworkVersionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "requirements_frameworkVersionId_requirementKey_key" ON "requirements"("frameworkVersionId", "requirementKey");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_requirement_mappings_requirementId_idx" ON "control_requirement_mappings"("requirementId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "control_requirement_mappings_controlId_requirementId_key" ON "control_requirement_mappings"("controlId", "requirementId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_implementations_controlId_idx" ON "control_implementations"("controlId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_implementations_scopeId_idx" ON "control_implementations"("scopeId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_implementations_organizationUnitId_idx" ON "control_implementations"("organizationUnitId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_implementations_siteId_idx" ON "control_implementations"("siteId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_implementation_requirements_requirementId_idx" ON "control_implementation_requirements"("requirementId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "control_implementation_requirements_implementationId_requir_key" ON "control_implementation_requirements"("implementationId", "requirementId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_findings_implementationId_idx" ON "control_findings"("implementationId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_actions_implementationId_idx" ON "control_actions"("implementationId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "control_actions_findingId_idx" ON "control_actions"("findingId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "soa_items_soaId_idx" ON "soa_items"("soaId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "soa_items_requirementId_idx" ON "soa_items"("requirementId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "soa_items_controlId_idx" ON "soa_items"("controlId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "soa_approvals_soaId_idx" ON "soa_approvals"("soaId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "incidents_displayId_key" ON "incidents"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incidents_significanceRuleVersionId_idx" ON "incidents"("significanceRuleVersionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "incident_assessments_incidentId_key" ON "incident_assessments"("incidentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_assessments_significanceRuleVersionId_idx" ON "incident_assessments"("significanceRuleVersionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "notification_deadlines_incidentId_idx" ON "notification_deadlines"("incidentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "notification_deadlines_deadlineDate_status_idx" ON "notification_deadlines"("deadlineDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "notification_deadlines_incidentId_notificationType_key" ON "notification_deadlines"("incidentId", "notificationType");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_knowledge_time_changes_incidentId_idx" ON "incident_knowledge_time_changes"("incidentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_reports_incidentId_idx" ON "incident_reports"("incidentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_reports_reportType_status_idx" ON "incident_reports"("reportType", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_communications_incidentId_idx" ON "incident_communications"("incidentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "incident_escalations_incidentId_status_idx" ON "incident_escalations"("incidentId", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "evidence_links_entityType_entityId_idx" ON "evidence_links"("entityType", "entityId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "evidence_links_evidenceId_entityType_entityId_key" ON "evidence_links"("evidenceId", "entityType", "entityId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "display_id_counters_entityType_key" ON "display_id_counters"("entityType");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "document_acknowledgements_userId_idx" ON "document_acknowledgements"("userId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "document_acknowledgements_documentId_versionId_userId_key" ON "document_acknowledgements"("documentId", "versionId", "userId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "document_reviews_documentId_idx" ON "document_reviews"("documentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "document_reviews_dueDate_idx" ON "document_reviews"("dueDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "document_reviews_status_idx" ON "document_reviews"("status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_displayId_key" ON "suppliers"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "suppliers_criticality_idx" ON "suppliers"("criticality");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "suppliers_nextReviewDate_idx" ON "suppliers"("nextReviewDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "supplier_assessments_supplierId_idx" ON "supplier_assessments"("supplierId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "supplier_assessments_nextAssessmentDate_idx" ON "supplier_assessments"("nextAssessmentDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "supplier_contract_relations_contractId_idx" ON "supplier_contract_relations"("contractId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "supplier_contract_relations_supplierId_contractId_key" ON "supplier_contract_relations"("supplierId", "contractId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "supplier_risk_relations_riskId_idx" ON "supplier_risk_relations"("riskId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "supplier_risk_relations_supplierId_riskId_key" ON "supplier_risk_relations"("supplierId", "riskId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "business_impact_analyses_displayId_key" ON "business_impact_analyses"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "business_impact_analyses_processId_idx" ON "business_impact_analyses"("processId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "business_impact_analyses_serviceId_idx" ON "business_impact_analyses"("serviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "business_impact_analyses_nextReviewDate_idx" ON "business_impact_analyses"("nextReviewDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "bia_asset_relations_assetId_idx" ON "bia_asset_relations"("assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "bia_asset_relations_biaId_assetId_key" ON "bia_asset_relations"("biaId", "assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "business_continuity_plans_displayId_key" ON "business_continuity_plans"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "business_continuity_plans_biaId_idx" ON "business_continuity_plans"("biaId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "business_continuity_plans_nextTestDate_idx" ON "business_continuity_plans"("nextTestDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "bcp_exercises_bcpId_idx" ON "bcp_exercises"("bcpId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "bcp_exercises_plannedAt_status_idx" ON "bcp_exercises"("plannedAt", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "audit_programs_displayId_key" ON "audit_programs"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_programs_year_status_idx" ON "audit_programs"("year", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "audit_plans_displayId_key" ON "audit_plans"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_plans_programId_idx" ON "audit_plans"("programId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_plans_plannedStart_status_idx" ON "audit_plans"("plannedStart", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "audit_findings_displayId_key" ON "audit_findings"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_findings_auditPlanId_idx" ON "audit_findings"("auditPlanId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_findings_dueDate_status_idx" ON "audit_findings"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "audit_evidence_relations_evidenceId_idx" ON "audit_evidence_relations"("evidenceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "audit_evidence_relations_auditFindingId_evidenceId_key" ON "audit_evidence_relations"("auditFindingId", "evidenceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "corrective_actions_displayId_key" ON "corrective_actions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "corrective_actions_sourceType_sourceId_idx" ON "corrective_actions"("sourceType", "sourceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "corrective_actions_dueDate_status_idx" ON "corrective_actions"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "training_courses_displayId_key" ON "training_courses"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "training_courses_category_status_idx" ON "training_courses"("category", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "training_assignments_userId_status_idx" ON "training_assignments"("userId", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "training_assignments_dueDate_status_idx" ON "training_assignments"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "training_assignments_courseId_userId_assignedAt_key" ON "training_assignments"("courseId", "userId", "assignedAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "training_completions_assignmentId_idx" ON "training_completions"("assignmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "training_completions_userId_expiresAt_idx" ON "training_completions"("userId", "expiresAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "training_acknowledgements_courseId_userId_version_key" ON "training_acknowledgements"("courseId", "userId", "version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "management_reviews_displayId_key" ON "management_reviews"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "management_reviews_reviewDate_status_idx" ON "management_reviews"("reviewDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "management_reviews_nextReviewDate_idx" ON "management_reviews"("nextReviewDate");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "management_review_actions_reviewId_idx" ON "management_review_actions"("reviewId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "management_review_actions_dueDate_status_idx" ON "management_review_actions"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "security_objectives_displayId_key" ON "security_objectives"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "security_objectives_ownerId_status_idx" ON "security_objectives"("ownerId", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "metric_definitions_displayId_key" ON "metric_definitions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "metric_definitions_objectiveId_idx" ON "metric_definitions"("objectiveId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "metric_definitions_metricType_status_idx" ON "metric_definitions"("metricType", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "metric_values_metricId_measuredAt_idx" ON "metric_values"("metricId", "measuredAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "metric_values_breachStatus_idx" ON "metric_values"("breachStatus");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_displayId_key" ON "workflow_definitions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_definitions_entityType_status_idx" ON "workflow_definitions"("entityType", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_name_version_key" ON "workflow_definitions"("name", "version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_instances_definitionId_idx" ON "workflow_instances"("definitionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_instances_dueDate_status_idx" ON "workflow_instances"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_tasks_instanceId_idx" ON "workflow_tasks"("instanceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_tasks_assigneeId_status_idx" ON "workflow_tasks"("assigneeId", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_tasks_dueDate_status_idx" ON "workflow_tasks"("dueDate", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "workflow_transition_logs_instanceId_idx" ON "workflow_transition_logs"("instanceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "report_definitions_displayId_key" ON "report_definitions"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "report_definitions_module_status_idx" ON "report_definitions"("module", "status");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "report_runs_definitionId_idx" ON "report_runs"("definitionId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "report_runs_module_startedAt_idx" ON "report_runs"("module", "startedAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "export_jobs_entityType_requestedAt_idx" ON "export_jobs"("entityType", "requestedAt");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "export_jobs_requestedBy_idx" ON "export_jobs"("requestedBy");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "nis2_registrations_assessmentId_idx" ON "nis2_registrations"("assessmentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "nis2_questionnaire_versions_version_key" ON "nis2_questionnaire_versions"("version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "nis2_registration_changes_registrationId_idx" ON "nis2_registration_changes"("registrationId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "nis2_incident_significance_rule_versions_version_key" ON "nis2_incident_significance_rule_versions"("version");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "sessions_refreshToken_key" ON "sessions"("refreshToken");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "intune_device_syncs_intuneId_key" ON "intune_device_syncs"("intuneId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "intune_device_syncs_assetId_key" ON "intune_device_syncs"("assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "intune_device_syncs_intuneId_idx" ON "intune_device_syncs"("intuneId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "intune_device_syncs_syncStatus_idx" ON "intune_device_syncs"("syncStatus");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "intune_device_syncs_lastSyncDateTime_idx" ON "intune_device_syncs"("lastSyncDateTime");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "intune_detected_apps_intuneAppId_idx" ON "intune_detected_apps"("intuneAppId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "intune_detected_apps_deviceId_idx" ON "intune_detected_apps"("deviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "intune_detected_apps_intuneAppId_deviceId_key" ON "intune_detected_apps"("intuneAppId", "deviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "contracts_displayId_key" ON "contracts"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "licenses_displayId_key" ON "licenses"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "business_processes_displayId_key" ON "business_processes"("displayId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_documents_assetId_documentId_key" ON "asset_documents"("assetId", "documentId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_evidence_riskId_evidenceId_key" ON "risk_evidence"("riskId", "evidenceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_assets_riskId_assetId_key" ON "risk_assets"("riskId", "assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "vulnerability_assets_vulnerabilityId_assetId_key" ON "vulnerability_assets"("vulnerabilityId", "assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "incident_assets_incidentId_assetId_key" ON "incident_assets"("incidentId", "assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_processes_assetId_processId_key" ON "asset_processes"("assetId", "processId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_services_assetId_serviceId_key" ON "asset_services"("assetId", "serviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_contracts_assetId_contractId_key" ON "asset_contracts"("assetId", "contractId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "asset_licenses_assetId_licenseId_key" ON "asset_licenses"("assetId", "licenseId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "contract_licenses_contractId_licenseId_key" ON "contract_licenses"("contractId", "licenseId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_processes_riskId_processId_key" ON "risk_processes"("riskId", "processId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "risk_services_riskId_serviceId_key" ON "risk_services"("riskId", "serviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "incident_services_incidentId_serviceId_key" ON "incident_services"("incidentId", "serviceId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "incident_processes_incidentId_processId_key" ON "incident_processes"("incidentId", "processId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "control_assets_controlId_assetId_key" ON "control_assets"("controlId", "assetId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "control_processes_controlId_processId_key" ON "control_processes"("controlId", "processId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "control_sites_controlId_siteId_key" ON "control_sites"("controlId", "siteId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "vcenter_servers_credentialId_idx" ON "vcenter_servers"("credentialId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "vcenter_servers_host_port_key" ON "vcenter_servers"("host", "port");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "proxmox_servers_credentialId_idx" ON "proxmox_servers"("credentialId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "proxmox_servers_host_port_nodeId_key" ON "proxmox_servers"("host", "port", "nodeId");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "_AssetRisks_AB_unique" ON "_AssetRisks"("A", "B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "_AssetRisks_B_index" ON "_AssetRisks"("B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "_AssetControls_AB_unique" ON "_AssetControls"("A", "B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "_AssetControls_B_index" ON "_AssetControls"("B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "_RiskControls_AB_unique" ON "_RiskControls"("A", "B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "_RiskControls_B_index" ON "_RiskControls"("B");
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_organizationUnitId_fkey') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_userId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_roleId_fkey') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_groups_userId_fkey') THEN
    ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_groups_groupId_fkey') THEN
    ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_groupId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_roles_roleId_fkey') THEN
    ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_units_parentId_fkey') THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_organizationUnitId_fkey') THEN
    ALTER TABLE "sites" ADD CONSTRAINT "sites_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_assetTypeId_fkey') THEN
    ALTER TABLE "assets" ADD CONSTRAINT "assets_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_organizationUnitId_fkey') THEN
    ALTER TABLE "assets" ADD CONSTRAINT "assets_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_locationId_fkey') THEN
    ALTER TABLE "assets" ADD CONSTRAINT "assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_relations_sourceAssetId_fkey') THEN
    ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_relations_targetAssetId_fkey') THEN
    ALTER TABLE "asset_relations" ADD CONSTRAINT "asset_relations_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_addresses_assetId_fkey') THEN
    ALTER TABLE "network_addresses" ADD CONSTRAINT "network_addresses_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_runs_integrationSourceId_fkey') THEN
    ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_records_importRunId_fkey') THEN
    ALTER TABLE "import_records" ADD CONSTRAINT "import_records_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_records_targetAssetId_fkey') THEN
    ALTER TABLE "import_records" ADD CONSTRAINT "import_records_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_conflicts_importRunId_fkey') THEN
    ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_conflicts_importRecordId_fkey') THEN
    ALTER TABLE "import_conflicts" ADD CONSTRAINT "import_conflicts_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "import_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_provenance_assetId_fkey') THEN
    ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_provenance_integrationSourceId_fkey') THEN
    ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_locks_assetId_fkey') THEN
    ALTER TABLE "field_locks" ADD CONSTRAINT "field_locks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_priorities_integrationSourceId_fkey') THEN
    ALTER TABLE "source_priorities" ADD CONSTRAINT "source_priorities_integrationSourceId_fkey" FOREIGN KEY ("integrationSourceId") REFERENCES "integration_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_method_versions_riskMethodId_fkey') THEN
    ALTER TABLE "risk_method_versions" ADD CONSTRAINT "risk_method_versions_riskMethodId_fkey" FOREIGN KEY ("riskMethodId") REFERENCES "risk_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_organizationUnitId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_businessProcessId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_businessProcessId_fkey" FOREIGN KEY ("businessProcessId") REFERENCES "business_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_riskMethodVersionId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_scenarioId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "risk_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_threatId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_vulnerabilityId_fkey') THEN
    ALTER TABLE "risks" ADD CONSTRAINT "risks_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assessments_riskId_fkey') THEN
    ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assessments_riskMethodVersionId_fkey') THEN
    ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "risk_method_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_treatments_riskId_fkey') THEN
    ALTER TABLE "risk_treatments" ADD CONSTRAINT "risk_treatments_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_acceptances_treatmentId_fkey') THEN
    ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_acceptances_assessmentId_fkey') THEN
    ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_treatment_approvals_treatmentId_fkey') THEN
    ALTER TABLE "risk_treatment_approvals" ADD CONSTRAINT "risk_treatment_approvals_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_treatment_effectiveness_reviews_treatmentId_fkey') THEN
    ALTER TABLE "risk_treatment_effectiveness_reviews" ADD CONSTRAINT "risk_treatment_effectiveness_reviews_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "risk_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_scenarios_threatId_fkey') THEN
    ALTER TABLE "risk_scenarios" ADD CONSTRAINT "risk_scenarios_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_scenarios_vulnerabilityId_fkey') THEN
    ALTER TABLE "risk_scenarios" ADD CONSTRAINT "risk_scenarios_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_cause_links_riskId_fkey') THEN
    ALTER TABLE "risk_cause_links" ADD CONSTRAINT "risk_cause_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_cause_links_causeId_fkey') THEN
    ALTER TABLE "risk_cause_links" ADD CONSTRAINT "risk_cause_links_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "risk_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_impact_links_riskId_fkey') THEN
    ALTER TABLE "risk_impact_links" ADD CONSTRAINT "risk_impact_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_impact_links_impactId_fkey') THEN
    ALTER TABLE "risk_impact_links" ADD CONSTRAINT "risk_impact_links_impactId_fkey" FOREIGN KEY ("impactId") REFERENCES "risk_impacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_tasks_riskId_fkey') THEN
    ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'framework_versions_frameworkId_fkey') THEN
    ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requirements_frameworkVersionId_fkey') THEN
    ALTER TABLE "requirements" ADD CONSTRAINT "requirements_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "framework_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_requirement_mappings_controlId_fkey') THEN
    ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_requirement_mappings_requirementId_fkey') THEN
    ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_implementations_controlId_fkey') THEN
    ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_implementation_requirements_implementationId_fkey') THEN
    ALTER TABLE "control_implementation_requirements" ADD CONSTRAINT "control_implementation_requirements_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_findings_implementationId_fkey') THEN
    ALTER TABLE "control_findings" ADD CONSTRAINT "control_findings_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_actions_implementationId_fkey') THEN
    ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_actions_findingId_fkey') THEN
    ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "control_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soa_items_soaId_fkey') THEN
    ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soa_items_controlId_fkey') THEN
    ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soa_approvals_soaId_fkey') THEN
    ALTER TABLE "soa_approvals" ADD CONSTRAINT "soa_approvals_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_significanceRuleVersionId_fkey') THEN
    ALTER TABLE "incidents" ADD CONSTRAINT "incidents_significanceRuleVersionId_fkey" FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assessments_incidentId_fkey') THEN
    ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assessments_significanceRuleVersionId_fkey') THEN
    ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_significanceRuleVersionId_fkey" FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deadlines_incidentId_fkey') THEN
    ALTER TABLE "notification_deadlines" ADD CONSTRAINT "notification_deadlines_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_knowledge_time_changes_incidentId_fkey') THEN
    ALTER TABLE "incident_knowledge_time_changes" ADD CONSTRAINT "incident_knowledge_time_changes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_reports_incidentId_fkey') THEN
    ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_communications_incidentId_fkey') THEN
    ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_escalations_incidentId_fkey') THEN
    ALTER TABLE "incident_escalations" ADD CONSTRAINT "incident_escalations_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_links_evidenceId_fkey') THEN
    ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_documentId_fkey') THEN
    ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_acknowledgements_documentId_fkey') THEN
    ALTER TABLE "document_acknowledgements" ADD CONSTRAINT "document_acknowledgements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_reviews_documentId_fkey') THEN
    ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nis2_registrations_assessmentId_fkey') THEN
    ALTER TABLE "nis2_registrations" ADD CONSTRAINT "nis2_registrations_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "nis2_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nis2_registration_changes_registrationId_fkey') THEN
    ALTER TABLE "nis2_registration_changes" ADD CONSTRAINT "nis2_registration_changes_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "nis2_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_documents_assetId_fkey') THEN
    ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_documents_documentId_fkey') THEN
    ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_evidence_riskId_fkey') THEN
    ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_evidence_evidenceId_fkey') THEN
    ALTER TABLE "risk_evidence" ADD CONSTRAINT "risk_evidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assets_riskId_fkey') THEN
    ALTER TABLE "risk_assets" ADD CONSTRAINT "risk_assets_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assets_assetId_fkey') THEN
    ALTER TABLE "risk_assets" ADD CONSTRAINT "risk_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vulnerability_assets_vulnerabilityId_fkey') THEN
    ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vulnerability_assets_assetId_fkey') THEN
    ALTER TABLE "vulnerability_assets" ADD CONSTRAINT "vulnerability_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assets_incidentId_fkey') THEN
    ALTER TABLE "incident_assets" ADD CONSTRAINT "incident_assets_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assets_assetId_fkey') THEN
    ALTER TABLE "incident_assets" ADD CONSTRAINT "incident_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_processes_assetId_fkey') THEN
    ALTER TABLE "asset_processes" ADD CONSTRAINT "asset_processes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_processes_processId_fkey') THEN
    ALTER TABLE "asset_processes" ADD CONSTRAINT "asset_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_services_assetId_fkey') THEN
    ALTER TABLE "asset_services" ADD CONSTRAINT "asset_services_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_services_serviceId_fkey') THEN
    ALTER TABLE "asset_services" ADD CONSTRAINT "asset_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_contracts_assetId_fkey') THEN
    ALTER TABLE "asset_contracts" ADD CONSTRAINT "asset_contracts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_contracts_contractId_fkey') THEN
    ALTER TABLE "asset_contracts" ADD CONSTRAINT "asset_contracts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_licenses_assetId_fkey') THEN
    ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_licenses_licenseId_fkey') THEN
    ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_licenses_contractId_fkey') THEN
    ALTER TABLE "contract_licenses" ADD CONSTRAINT "contract_licenses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_licenses_licenseId_fkey') THEN
    ALTER TABLE "contract_licenses" ADD CONSTRAINT "contract_licenses_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_processes_riskId_fkey') THEN
    ALTER TABLE "risk_processes" ADD CONSTRAINT "risk_processes_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_processes_processId_fkey') THEN
    ALTER TABLE "risk_processes" ADD CONSTRAINT "risk_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_services_riskId_fkey') THEN
    ALTER TABLE "risk_services" ADD CONSTRAINT "risk_services_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_services_serviceId_fkey') THEN
    ALTER TABLE "risk_services" ADD CONSTRAINT "risk_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_services_incidentId_fkey') THEN
    ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_services_serviceId_fkey') THEN
    ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_processes_incidentId_fkey') THEN
    ALTER TABLE "incident_processes" ADD CONSTRAINT "incident_processes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_processes_processId_fkey') THEN
    ALTER TABLE "incident_processes" ADD CONSTRAINT "incident_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_assets_controlId_fkey') THEN
    ALTER TABLE "control_assets" ADD CONSTRAINT "control_assets_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_assets_assetId_fkey') THEN
    ALTER TABLE "control_assets" ADD CONSTRAINT "control_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_processes_controlId_fkey') THEN
    ALTER TABLE "control_processes" ADD CONSTRAINT "control_processes_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_processes_processId_fkey') THEN
    ALTER TABLE "control_processes" ADD CONSTRAINT "control_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_sites_controlId_fkey') THEN
    ALTER TABLE "control_sites" ADD CONSTRAINT "control_sites_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_sites_siteId_fkey') THEN
    ALTER TABLE "control_sites" ADD CONSTRAINT "control_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vcenter_servers_credentialId_fkey') THEN
    ALTER TABLE "vcenter_servers" ADD CONSTRAINT "vcenter_servers_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "vmware_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proxmox_servers_credentialId_fkey') THEN
    ALTER TABLE "proxmox_servers" ADD CONSTRAINT "proxmox_servers_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "proxmox_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AssetRisks_A_fkey') THEN
    ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AssetRisks_B_fkey') THEN
    ALTER TABLE "_AssetRisks" ADD CONSTRAINT "_AssetRisks_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AssetControls_A_fkey') THEN
    ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_A_fkey" FOREIGN KEY ("A") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AssetControls_B_fkey') THEN
    ALTER TABLE "_AssetControls" ADD CONSTRAINT "_AssetControls_B_fkey" FOREIGN KEY ("B") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_RiskControls_A_fkey') THEN
    ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_A_fkey" FOREIGN KEY ("A") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_RiskControls_B_fkey') THEN
    ALTER TABLE "_RiskControls" ADD CONSTRAINT "_RiskControls_B_fkey" FOREIGN KEY ("B") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;

