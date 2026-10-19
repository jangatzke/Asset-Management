-- Support generic OIDC providers (Authentik, Keycloak, …) in addition to Entra ID.
-- The issuer URL drives openid-client discovery; tenantId remains the legacy
-- Entra-only field and is now optional for non-entra providers.
ALTER TABLE "oidc_configs"
ADD COLUMN IF NOT EXISTS "issuerUrl" TEXT;
