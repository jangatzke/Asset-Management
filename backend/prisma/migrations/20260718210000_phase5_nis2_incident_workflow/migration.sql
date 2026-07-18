-- Phase 5: NIS-2 applicability, registration, measures catalogue and incident workflow

ALTER TABLE "incidents"
  ADD COLUMN "significanceRuleVersionId" TEXT,
  ADD COLUMN "isSignificant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "significanceReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rootCause" TEXT,
  ADD COLUMN "lessonsLearned" TEXT,
  ADD COLUMN "measuresEvaluation" TEXT,
  ADD COLUMN "closureSummary" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedBy" TEXT;

ALTER TABLE "incident_assessments"
  ADD COLUMN "decisionApprovedAt" TIMESTAMP(3),
  ADD COLUMN "significanceRuleVersionId" TEXT,
  ADD COLUMN "evaluatedRules" JSONB;

ALTER TABLE "nis2_assessments"
  ADD COLUMN "questionnaireVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "answers" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "preliminaryResult" TEXT,
  ADD COLUMN "preliminaryJustification" TEXT,
  ADD COLUMN "submittedForApprovalAt" TIMESTAMP(3),
  ADD COLUMN "submittedForApprovalBy" TEXT;

ALTER TABLE "nis2_registrations"
  ADD COLUMN "assessmentId" TEXT;

CREATE TABLE "nis2_questionnaire_versions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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

CREATE TABLE "nis2_registration_changes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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

CREATE TABLE "nis2_incident_significance_rule_versions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "nis2_incident_significance_rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incident_knowledge_time_changes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "incidentId" TEXT NOT NULL,
  "oldKnowledgeTime" TIMESTAMP(3) NOT NULL,
  "newKnowledgeTime" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_knowledge_time_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incident_reports" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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

CREATE TABLE "incident_communications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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

CREATE TABLE "incident_escalations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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

CREATE UNIQUE INDEX "nis2_questionnaire_versions_version_key" ON "nis2_questionnaire_versions"("version");
CREATE UNIQUE INDEX "nis2_incident_significance_rule_versions_version_key" ON "nis2_incident_significance_rule_versions"("version");
CREATE UNIQUE INDEX "notification_deadlines_incidentId_notificationType_key" ON "notification_deadlines"("incidentId", "notificationType");
CREATE INDEX "notification_deadlines_incidentId_idx" ON "notification_deadlines"("incidentId");
CREATE INDEX "notification_deadlines_deadlineDate_status_idx" ON "notification_deadlines"("deadlineDate", "status");
CREATE INDEX "incidents_significanceRuleVersionId_idx" ON "incidents"("significanceRuleVersionId");
CREATE INDEX "incident_assessments_significanceRuleVersionId_idx" ON "incident_assessments"("significanceRuleVersionId");
CREATE INDEX "nis2_registrations_assessmentId_idx" ON "nis2_registrations"("assessmentId");
CREATE INDEX "nis2_registration_changes_registrationId_idx" ON "nis2_registration_changes"("registrationId");
CREATE INDEX "incident_knowledge_time_changes_incidentId_idx" ON "incident_knowledge_time_changes"("incidentId");
CREATE INDEX "incident_reports_incidentId_idx" ON "incident_reports"("incidentId");
CREATE INDEX "incident_reports_reportType_status_idx" ON "incident_reports"("reportType", "status");
CREATE INDEX "incident_communications_incidentId_idx" ON "incident_communications"("incidentId");
CREATE INDEX "incident_escalations_incidentId_status_idx" ON "incident_escalations"("incidentId", "status");

ALTER TABLE "incidents" ADD CONSTRAINT "incidents_significanceRuleVersionId_fkey" FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_significanceRuleVersionId_fkey" FOREIGN KEY ("significanceRuleVersionId") REFERENCES "nis2_incident_significance_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deadlines" ADD CONSTRAINT "notification_deadlines_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nis2_registrations" ADD CONSTRAINT "nis2_registrations_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "nis2_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nis2_registration_changes" ADD CONSTRAINT "nis2_registration_changes_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "nis2_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_knowledge_time_changes" ADD CONSTRAINT "incident_knowledge_time_changes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_escalations" ADD CONSTRAINT "incident_escalations_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
