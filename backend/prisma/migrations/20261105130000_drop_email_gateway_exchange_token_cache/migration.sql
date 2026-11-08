-- Drop the unused Exchange OAuth2 token-cache columns from email_gateway_config.
--
-- Exchange access tokens are held only in the MSAL in-memory cache inside
-- backend/src/services/emailGateway.service.ts (acquireExchangeToken). They were
-- never written to these columns, so the columns are dead weight and a latent
-- secret-storage footgun.
--
-- This migration is idempotent for PostgreSQL (IF EXISTS) so it is safe on
-- databases where a previous deploy already removed the columns.

ALTER TABLE "email_gateway_config"
  DROP COLUMN IF EXISTS "exchangeAccessToken";

ALTER TABLE "email_gateway_config"
  DROP COLUMN IF EXISTS "exchangeAccessTokenExpiry";
