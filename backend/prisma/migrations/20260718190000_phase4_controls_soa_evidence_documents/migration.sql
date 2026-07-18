-- Phase 4: Controls, SoA, Evidence and Document Control

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "workflowStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewerId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "approverId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewIntervalDays" INTEGER;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false;

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "control_implementations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "control_implementation_requirements" (
  "id" TEXT NOT NULL,
  "implementationId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  CONSTRAINT "control_implementation_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "control_findings" (
  "id" TEXT NOT NULL,
  "implementationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "control_findings_pkey" PRIMARY KEY ("id")
);

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "control_actions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "statements_of_applicability" ALTER COLUMN "controls" DROP NOT NULL;
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "submittedBy" TEXT;
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT;
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "statements_of_applicability" ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false;

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "soa_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "soa_approvals" (
  "id" TEXT NOT NULL,
  "soaId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "soa_approvals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "relatedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "relatedSoAItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "relatedDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "deleteProtected" BOOLEAN NOT NULL DEFAULT false;

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

ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "reviewerId" TEXT;
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "approverId" TEXT;
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "reviewIntervalDays" INTEGER;
ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "document_acknowledgements" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "userId" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" TEXT,
  CONSTRAINT "document_acknowledgements_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX IF NOT EXISTS "framework_versions_frameworkId_version_key" ON "framework_versions"("frameworkId", "version");
CREATE INDEX IF NOT EXISTS "framework_versions_frameworkId_idx" ON "framework_versions"("frameworkId");
CREATE UNIQUE INDEX IF NOT EXISTS "requirements_frameworkVersionId_requirementKey_key" ON "requirements"("frameworkVersionId", "requirementKey");
CREATE INDEX IF NOT EXISTS "requirements_frameworkVersionId_idx" ON "requirements"("frameworkVersionId");
CREATE UNIQUE INDEX IF NOT EXISTS "control_requirement_mappings_controlId_requirementId_key" ON "control_requirement_mappings"("controlId", "requirementId");
CREATE INDEX IF NOT EXISTS "control_requirement_mappings_requirementId_idx" ON "control_requirement_mappings"("requirementId");
CREATE INDEX IF NOT EXISTS "control_implementations_controlId_idx" ON "control_implementations"("controlId");
CREATE INDEX IF NOT EXISTS "control_implementations_scopeId_idx" ON "control_implementations"("scopeId");
CREATE INDEX IF NOT EXISTS "control_implementations_organizationUnitId_idx" ON "control_implementations"("organizationUnitId");
CREATE INDEX IF NOT EXISTS "control_implementations_siteId_idx" ON "control_implementations"("siteId");
CREATE UNIQUE INDEX IF NOT EXISTS "control_implementation_requirements_implementationId_requirementId_key" ON "control_implementation_requirements"("implementationId", "requirementId");
CREATE INDEX IF NOT EXISTS "control_implementation_requirements_requirementId_idx" ON "control_implementation_requirements"("requirementId");
CREATE INDEX IF NOT EXISTS "control_findings_implementationId_idx" ON "control_findings"("implementationId");
CREATE INDEX IF NOT EXISTS "control_actions_implementationId_idx" ON "control_actions"("implementationId");
CREATE INDEX IF NOT EXISTS "control_actions_findingId_idx" ON "control_actions"("findingId");
CREATE INDEX IF NOT EXISTS "soa_items_soaId_idx" ON "soa_items"("soaId");
CREATE INDEX IF NOT EXISTS "soa_items_requirementId_idx" ON "soa_items"("requirementId");
CREATE INDEX IF NOT EXISTS "soa_items_controlId_idx" ON "soa_items"("controlId");
CREATE INDEX IF NOT EXISTS "soa_approvals_soaId_idx" ON "soa_approvals"("soaId");
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_links_evidenceId_entityType_entityId_key" ON "evidence_links"("evidenceId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "evidence_links_entityType_entityId_idx" ON "evidence_links"("entityType", "entityId");
CREATE UNIQUE INDEX IF NOT EXISTS "document_acknowledgements_documentId_versionId_userId_key" ON "document_acknowledgements"("documentId", "versionId", "userId");
CREATE INDEX IF NOT EXISTS "document_acknowledgements_userId_idx" ON "document_acknowledgements"("userId");
CREATE INDEX IF NOT EXISTS "document_reviews_documentId_idx" ON "document_reviews"("documentId");
CREATE INDEX IF NOT EXISTS "document_reviews_dueDate_idx" ON "document_reviews"("dueDate");
CREATE INDEX IF NOT EXISTS "document_reviews_status_idx" ON "document_reviews"("status");

ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "framework_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_requirement_mappings" ADD CONSTRAINT "control_requirement_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_implementations" ADD CONSTRAINT "control_implementations_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_implementation_requirements" ADD CONSTRAINT "control_implementation_requirements_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_findings" ADD CONSTRAINT "control_findings_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_implementationId_fkey" FOREIGN KEY ("implementationId") REFERENCES "control_implementations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_actions" ADD CONSTRAINT "control_actions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "control_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "soa_items" ADD CONSTRAINT "soa_items_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soa_approvals" ADD CONSTRAINT "soa_approvals_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "statements_of_applicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_acknowledgements" ADD CONSTRAINT "document_acknowledgements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
