-- ============================================================
-- webhook signing-secret rotation state
-- ============================================================
-- Adds rotation-epoch columns to webhooks so a webhook's HMAC signing secret
-- can be rotated without disrupting delivery. The previous secret remains
-- valid until webhookSecretValidUntil (deprecation window) so consumers can
-- migrate before the old secret is purged.

ALTER TABLE "webhooks"
  ADD COLUMN "previousWebhookSecret" TEXT,
  ADD COLUMN "webhookSecretId" VARCHAR(8),
  ADD COLUMN "previousWebhookSecretId" VARCHAR(8),
  ADD COLUMN "webhookSecretValidUntil" TIMESTAMP(3);
