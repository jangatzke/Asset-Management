-- Reminder automation configuration and delivery evidence.
-- Idempotent for local databases with migration drift.

CREATE TABLE IF NOT EXISTS "reminder_config" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 1440,
  "lookAheadDays" INTEGER NOT NULL DEFAULT 0,
  "reminderFromEmail" TEXT,
  "reminderSubjectPrefix" TEXT NOT NULL DEFAULT '[ISMS Reminder]',
  "smtpHost" TEXT,
  "smtpPort" INTEGER NOT NULL DEFAULT 587,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
  "smtpUser" TEXT,
  "smtpPassword" TEXT,
  "smtpRejectUnauthorized" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "lastRunMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
);

ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "intervalMinutes" INTEGER NOT NULL DEFAULT 1440;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "lookAheadDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "reminderFromEmail" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "reminderSubjectPrefix" TEXT NOT NULL DEFAULT '[ISMS Reminder]';
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER NOT NULL DEFAULT 587;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpPassword" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "smtpRejectUnauthorized" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3);
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "lastRunStatus" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "lastRunMessage" TEXT;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "reminder_config" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

CREATE TABLE IF NOT EXISTS "reminder_delivery_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "runId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "recipientUserId" TEXT,
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "dueDate" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "runId" TEXT NOT NULL;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "resource" TEXT NOT NULL;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "entityId" TEXT NOT NULL;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "reminder_delivery_logs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "reminder_delivery_logs_runId_idx" ON "reminder_delivery_logs"("runId");
CREATE INDEX IF NOT EXISTS "reminder_delivery_logs_resource_entityId_idx" ON "reminder_delivery_logs"("resource", "entityId");
CREATE INDEX IF NOT EXISTS "reminder_delivery_logs_status_createdAt_idx" ON "reminder_delivery_logs"("status", "createdAt");

INSERT INTO "reminder_config" ("id", "enabled", "intervalMinutes", "lookAheadDays", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, false, 1440, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "reminder_config");
