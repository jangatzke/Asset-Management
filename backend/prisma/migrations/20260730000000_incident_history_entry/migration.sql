-- Create IncidentHistoryEntry table
CREATE TABLE "incident_history_entries" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldChanges" JSONB,
    "summary" TEXT,
    "actorId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_history_entries_pkey" PRIMARY KEY ("id")
);

-- Index for querying history by incident, ordered by time
CREATE INDEX "incident_history_entries_incidentId_createdAt_idx" ON "incident_history_entries"("incidentId", "createdAt");

-- Index for filtering by action type
CREATE INDEX "incident_history_entries_action_idx" ON "incident_history_entries"("action");

-- Foreign key to incidents with cascade delete
ALTER TABLE "incident_history_entries" 
    ADD CONSTRAINT "incident_history_entries_incidentId_fkey" 
    FOREIGN KEY ("incidentId") 
    REFERENCES "incidents"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
