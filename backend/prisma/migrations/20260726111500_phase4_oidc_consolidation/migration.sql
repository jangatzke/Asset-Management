-- Phase 4: OIDC authorization code flow consolidation
ALTER TABLE "oidc_configs"
ADD COLUMN IF NOT EXISTS "clientSecretRef" TEXT,
ADD COLUMN IF NOT EXISTS "autoProvisioningRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "oidc_login_states" (
  "id" TEXT NOT NULL,
  "oidcConfigId" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "oidc_login_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oidc_login_states_stateHash_key" ON "oidc_login_states"("stateHash");
CREATE INDEX IF NOT EXISTS "oidc_login_states_oidcConfigId_expiresAt_idx" ON "oidc_login_states"("oidcConfigId", "expiresAt");
CREATE INDEX IF NOT EXISTS "oidc_login_states_usedAt_idx" ON "oidc_login_states"("usedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oidc_login_states_oidcConfigId_fkey'
  ) THEN
    ALTER TABLE "oidc_login_states"
    ADD CONSTRAINT "oidc_login_states_oidcConfigId_fkey"
    FOREIGN KEY ("oidcConfigId") REFERENCES "oidc_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "oidc_account_links" (
  "id" TEXT NOT NULL,
  "oidcConfigId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oidc_account_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oidc_account_links_oidcConfigId_subject_key" ON "oidc_account_links"("oidcConfigId", "subject");
CREATE UNIQUE INDEX IF NOT EXISTS "oidc_account_links_providerName_subject_key" ON "oidc_account_links"("providerName", "subject");
CREATE INDEX IF NOT EXISTS "oidc_account_links_userId_idx" ON "oidc_account_links"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oidc_account_links_oidcConfigId_fkey'
  ) THEN
    ALTER TABLE "oidc_account_links"
    ADD CONSTRAINT "oidc_account_links_oidcConfigId_fkey"
    FOREIGN KEY ("oidcConfigId") REFERENCES "oidc_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oidc_account_links_userId_fkey'
  ) THEN
    ALTER TABLE "oidc_account_links"
    ADD CONSTRAINT "oidc_account_links_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
