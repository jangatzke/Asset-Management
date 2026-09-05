-- ============================================================
-- service_account token rotation state
-- ============================================================
-- Adds opaque rotation-epoch columns to service_accounts so a
-- service-account token can be rotated without deactivating the
-- account row. Tokens minted during the short deprecation window
-- (previousTokenRotationId + tokenRotationValidUntil) remain valid
-- so consumers can migrate before the stale token is rejected.

ALTER TABLE "service_accounts"
  ADD COLUMN "tokenRotationId" VARCHAR(8),
  ADD COLUMN "previousTokenRotationId" VARCHAR(8),
  ADD COLUMN "tokenRotationValidUntil" TIMESTAMP(3);
