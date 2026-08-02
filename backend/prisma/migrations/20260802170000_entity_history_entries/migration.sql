-- CreateTable
CREATE TABLE "entity_history_entries" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldChanges" JSONB,
    "summary" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_history_entries_entityType_entityId_createdAt_idx" ON "entity_history_entries"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "entity_history_entries_action_idx" ON "entity_history_entries"("action");
