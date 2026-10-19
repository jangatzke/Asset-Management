-- CreateTable: AI assistant configuration (OpenAI-compatible API)
CREATE TABLE "ai_config" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT,
    "model" TEXT,
    "apiKey" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 1200,
    "requestTimeoutSeconds" INTEGER NOT NULL DEFAULT 60,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "summarizeTickets" BOOLEAN NOT NULL DEFAULT true,
    "knowledgeDrafts" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ai_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_config_configKey_key" ON "ai_config"("configKey");

-- CreateTable: Audit protocol of AI-assisted activity
CREATE TABLE "ai_activity_log" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "errorMessage" TEXT,
    "model" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_activity_log_runId_createdAt_idx" ON "ai_activity_log"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_activity_log_taskType_createdAt_idx" ON "ai_activity_log"("taskType", "createdAt");
