-- Align Phase 9 audit integrity columns with the current Prisma schema.
-- Earlier SQL migrations created snake_case columns while schema.prisma uses
-- quoted camelCase column names.

ALTER TABLE "audit_logs" RENAME COLUMN "previous_hash" TO "previousHash";
ALTER TABLE "audit_logs" RENAME COLUMN "entry_hash" TO "entryHash";

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "previousHash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entryHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "audit_checkpoints" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "audit_checkpoints" RENAME COLUMN "external_reference" TO "externalReference";

ALTER TABLE "audit_checkpoints" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "audit_checkpoints" ADD COLUMN IF NOT EXISTS "externalReference" VARCHAR(255);
