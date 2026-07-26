-- Phase 2 authentication/session hardening.
-- Existing refresh-token rows from the legacy prototype are removed because the previous
-- table stored bcrypt hashes without token family/rotation metadata and cannot be safely migrated.
TRUNCATE TABLE "refresh_tokens";

DROP INDEX IF EXISTS "refresh_tokens_token_key";

ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "token";
ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "revoked";
ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "createdAt";

ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" TEXT NOT NULL;
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" TEXT NOT NULL;
ALTER TABLE "refresh_tokens" ADD COLUMN "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "refresh_tokens" ADD COLUMN "usedAt" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN "replacedById" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "userAgent" TEXT;

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
