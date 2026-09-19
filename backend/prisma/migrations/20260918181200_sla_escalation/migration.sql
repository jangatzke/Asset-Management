-- ==========================================
-- SLA Breach Escalation (ITIL: escalation policy)
-- (additive; no destructive changes)
-- ==========================================

CREATE TABLE "sla_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "notifyAssignee" BOOLEAN NOT NULL DEFAULT true,
    "notifyManager" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "escalationLevels" TEXT NOT NULL DEFAULT '["1","2","3"]'::jsonb,
    "escalationDelayMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "sla_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sla_escalation_logs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "escalationId" TEXT,
    "breachType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "escalatedTo" TEXT,
    "escalatedToType" TEXT NOT NULL DEFAULT 'user',
    "sentVia" TEXT NOT NULL DEFAULT 'in-app',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sla_escalation_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sla_escalation_logs_ticketId_breachType_level_key" ON "sla_escalation_logs"("ticketId", "breachType", "level");

CREATE INDEX "sla_escalation_logs_ticketId_createdAt_idx" ON "sla_escalation_logs"("ticketId", "createdAt");

CREATE INDEX "sla_escalation_logs_breachType_createdAt_idx" ON "sla_escalation_logs"("breachType", "createdAt");

ALTER TABLE "sla_escalation_logs"
  ADD CONSTRAINT "sla_escalation_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
