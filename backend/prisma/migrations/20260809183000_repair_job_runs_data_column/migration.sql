-- Repair databases created with the original Phase 10 migration, which omitted
-- the nullable payload column declared by the current PostgreSQL Prisma schema.
-- This is additive and idempotent: existing job-run rows remain untouched and
-- receive NULL for "data" when the column is added.
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "data" TEXT;
