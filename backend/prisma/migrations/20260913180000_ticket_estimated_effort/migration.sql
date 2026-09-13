-- Store planned ticket workload in 15-minute work units and support weekly
-- workload aggregation by assignee and SLA resolution target.
ALTER TABLE "tickets" ADD COLUMN "estimatedEffortUnits" INTEGER;

CREATE INDEX "tickets_assigneeId_resolutionDueAt_idx"
  ON "tickets"("assigneeId", "resolutionDueAt");
