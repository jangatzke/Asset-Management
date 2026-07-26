-- Phase 10: Background Jobs Cluster-Safety -- JobRun tracking table

CREATE TABLE IF NOT EXISTS "job_runs" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "jobId"        VARCHAR      NOT NULL,
    "jobType"      VARCHAR      NOT NULL,
    "status"       VARCHAR      NOT NULL DEFAULT 'pending',
    "workerId"     VARCHAR,
    "scheduledAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt"    TIMESTAMP(3),
    "finishedAt"   TIMESTAMP(3),
    "error"        TEXT,
    "attempt"      INTEGER      NOT NULL DEFAULT 1,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_runs_jobType_status_idx" ON "job_runs"("jobType", "status");
CREATE INDEX "job_runs_scheduledAt_idx"     ON "job_runs"("scheduledAt");
