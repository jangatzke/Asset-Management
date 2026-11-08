-- ============================================================================
-- Item 4: Scheduler/job-runner resilience — JobRun/JobLease retention indexes
--
-- PostgreSQL migration (idempotent, additive).
--
-- Retention policy implemented in backend/src/services/jobRetention.service.ts:
--   * job_runs: delete terminal rows (completed|skipped|failed) where finishedAt
--     is older than JOB_RUN_RETENTION_DAYS (default 30 days).
--   * job_leases: delete rows where leaseUntil AND heartbeatAt are older than
--     JOB_LEASE_RETENTION_DAYS (default 7 days).
--
-- These indexes serve the pruning predicates so cleanup stays bounded even on
-- large audit tables. SQL Server mirror steps are documented at the bottom of
-- this file (migrations/ is PostgreSQL-only).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. job_runs: terminal-rows pruning index
-- ---------------------------------------------------------------------------
-- Predicate: WHERE status IN ('completed','skipped','failed')
--              AND finishedAt < :cutoff
-- A composite (status, finishedAt) index lets PostgreSQL use one index scan
-- for the batch SELECT and avoids a full table scan of job_runs history.
CREATE INDEX IF NOT EXISTS "job_runs_status_finishedat_idx"
  ON "job_runs" ("status", "finishedAt");

-- Standalone finishedAt index for generic time-range queries / audits.
CREATE INDEX IF NOT EXISTS "job_runs_finishedat_idx"
  ON "job_runs" ("finishedAt");

-- ---------------------------------------------------------------------------
-- 2. job_leases: stale-lease pruning index
-- ---------------------------------------------------------------------------
-- Predicate: WHERE leaseUntil < :cutoff AND heartbeatAt < :cutoff
CREATE INDEX IF NOT EXISTS "job_leases_leaseuntil_heartbeatat_idx"
  ON "job_leases" ("leaseUntil", "heartbeatAt");

-- ---------------------------------------------------------------------------
-- SQL Server mirror (NOT executed by `prisma migrate deploy`)
-- ---------------------------------------------------------------------------
-- migrations/ is PostgreSQL-only. Apply the equivalent steps manually (or with
-- a provider-aware migration) when DB_PROVIDER=sqlserver:
--
--   CREATE INDEX "job_runs_status_finishedat_idx"
--     ON "job_runs" ("status", "finishedAt");
--   CREATE INDEX "job_runs_finishedat_idx"
--     ON "job_runs" ("finishedAt");
--   CREATE INDEX "job_leases_leaseuntil_heartbeatat_idx"
--     ON "job_leases" ("leaseUntil", "heartbeatAt");
--
-- IMPORTANT: the SQL Server Prisma schema (schema.sqlserver.prisma) mirrors the
-- same model indexes (`@@index([status, finishedAt])`) so Prisma-generated
-- schema and the manual DDL agree.
