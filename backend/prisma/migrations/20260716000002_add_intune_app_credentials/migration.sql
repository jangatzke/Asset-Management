-- Add Intune App Credentials table
-- Separate Entra app credentials for Intune API (different from OIDC)

CREATE TABLE "intune_app_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Intune API Credentials',
    "tenantId" TEXT,
    "appId" TEXT,
    "clientSecret" TEXT,
    "clientSecretExpiresAt" TIMESTAMPTZ,
    "certificateThumbprint" TEXT,
    "isConfigured" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "intune_app_credentials_pkey" PRIMARY KEY ("id")
);

-- Only one set of credentials allowed at a time
CREATE UNIQUE INDEX "intune_app_credentials_unique" ON "intune_app_credentials"("id");