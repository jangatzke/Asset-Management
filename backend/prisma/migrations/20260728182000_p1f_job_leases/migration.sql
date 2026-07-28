-- P1-F: Cluster-safe Background Jobs -- durable lease table
-- Preserves existing job_runs history and replaces runtime PostgreSQL advisory locks
-- with owner-scoped, expiring leases that are safe across Prisma pooled sessions.

CREATE TABLE IF NOT EXISTS "job_leases" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "jobName"       VARCHAR      NOT NULL,
    "ownerId"       VARCHAR      NOT NULL,
    "leaseUntil"    TIMESTAMP(3) NOT NULL,
    "heartbeatAt"   TIMESTAMP(3) NOT NULL,
    "acquiredAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_leases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_leases_jobName_key" ON "job_leases"("jobName");
CREATE INDEX IF NOT EXISTS "job_leases_leaseUntil_idx" ON "job_leases"("leaseUntil");
CREATE INDEX IF NOT EXISTS "job_leases_ownerId_idx" ON "job_leases"("ownerId");
