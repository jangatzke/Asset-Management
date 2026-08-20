-- Phase B: NIS2 Incident Reporting (Art. 23)
-- Adds NIS2-specific fields to the incidents table for tracking
-- the 24-hour notification and 30-day final report deadlines.

-- Add NIS2 reporting fields to incidents table
ALTER TABLE "incidents" ADD COLUMN "nis2Relevant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "incidents" ADD COLUMN "nis2Severity" TEXT NOT NULL DEFAULT 'not_assessed';
ALTER TABLE "incidents" ADD COLUMN "nis2ReportedAt" TIMESTAMPTZ;
ALTER TABLE "incidents" ADD COLUMN "nis2ReportDeadline" TIMESTAMPTZ;
ALTER TABLE "incidents" ADD COLUMN "nis2FinalReportDue" TIMESTAMPTZ;

-- Add index for querying NIS2-relevant incidents
CREATE INDEX "incidents_nis2_relevant_idx" ON "incidents" ("nis2Relevant");
CREATE INDEX "incidents_nis2_report_deadline_idx" ON "incidents" ("nis2ReportDeadline");
CREATE INDEX "incidents_nis2_final_report_due_idx" ON "incidents" ("nis2FinalReportDue");

-- Add comment for documentation
COMMENT ON COLUMN "incidents"."nis2Relevant" IS 'Whether this incident is subject to NIS2 Art. 23 reporting obligations';
COMMENT ON COLUMN "incidents"."nis2Severity" IS 'NIS2 reporting stage: not_assessed, early_warning, notification, final';
COMMENT ON COLUMN "incidents"."nis2ReportedAt" IS 'Timestamp when the incident was reported to the competent authority (BSI)';
COMMENT ON COLUMN "incidents"."nis2ReportDeadline" IS '24-hour deadline for NIS2 notification (derived from detection/knowledge time)';
COMMENT ON COLUMN "incidents"."nis2FinalReportDue" IS '30-day deadline for final NIS2 report (derived from notification)';
