-- Persisted, single-use pre-authentication challenges for MFA login,
-- MFA enrollment, and password-change pre-auth flows.
CREATE TABLE "pre_auth_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jtiHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "pre_auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pre_auth_challenges_jtiHash_key" ON "pre_auth_challenges"("jtiHash");
CREATE INDEX "pre_auth_challenges_userId_purpose_idx" ON "pre_auth_challenges"("userId", "purpose");
CREATE INDEX "pre_auth_challenges_expiresAt_idx" ON "pre_auth_challenges"("expiresAt");
CREATE INDEX "pre_auth_challenges_usedAt_idx" ON "pre_auth_challenges"("usedAt");

ALTER TABLE "pre_auth_challenges" ADD CONSTRAINT "pre_auth_challenges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
