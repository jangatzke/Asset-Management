/**
 * Webhook signing-secret rotation helpers.
 *
 * A webhook's HMAC signing secret can be rotated without disrupting delivery.
 * After a rotation the new secret is authoritative, but the previous secret
 * remains valid for a short deprecation window so that consumers which have
 * not yet picked up the new secret can still verify signatures.
 *
 * The account stores:
 *   - `webhookSecretId`     current secret epoch (8 hex chars, opaque)
 *   - `previousWebhookSecretId` the epoch before the most recent rotation
 *   - `webhookSecretValidUntil` timestamp until which the previous epoch is
 *     still accepted (null = no window)
 *
 * The actual secret material is stored in `secret` (current) and
 * `previousWebhookSecret` (the secret that was valid before the most recent
 * rotation). The previous secret is kept only for the deprecation window and
 * must never be returned to clients.
 */

import crypto from 'crypto';

const ROTATION_ID_BYTES = 4;
const ROTATION_ID_REGEX = /^[0-9a-f]{8}$/;

/**
 * Parse and structurally validate a webhook secret epoch id.
 */
export function parseWebhookSecretEpoch(epoch: string | null | undefined): string | null {
  if (typeof epoch === 'string' && ROTATION_ID_REGEX.test(epoch)) {
    return epoch;
  }
  return null;
}

/**
 * Decide whether a candidate secret epoch is acceptable for the webhook.
 *
 * @param candidateEpoch The epoch the incoming signature was produced with.
 * @param webhook        The webhook's current rotation state.
 * @param now            Reference time (injectable for tests).
 */
export function isWebhookSecretRotationValid(
  candidateEpoch: string | null | undefined,
  webhook: {
    webhookSecretId: string | null | undefined;
    previousWebhookSecretId: string | null | undefined;
    webhookSecretValidUntil: Date | null | undefined,
  },
  now: Date = new Date()
): boolean {
  const hasRotationState = !!(webhook.webhookSecretId || webhook.previousWebhookSecretId);
  if (!hasRotationState) {
    // Webhook never rotated — any non-empty epoch is accepted.
    return !!candidateEpoch;
  }

  const current = parseWebhookSecretEpoch(webhook.webhookSecretId);
  const previous = parseWebhookSecretEpoch(webhook.previousWebhookSecretId);

  if (candidateEpoch && current && candidateEpoch === current) {
    return true;
  }

  if (candidateEpoch && previous && candidateEpoch === previous) {
    return !!webhook.webhookSecretValidUntil &&
      now.getTime() <= webhook.webhookSecretValidUntil.getTime();
  }

  return false;
}

/**
 * Rotate a webhook's signing secret. Returns the new rotation epoch and the
 * deprecation parameters to persist on the account.
 */
export function rotateWebhookSecret(): {
  epochId: string;
  previousEpochId: string;
  validUntil: Date;
} {
  const epochId = crypto.randomBytes(ROTATION_ID_BYTES).toString('hex');
  const previousEpochId = crypto.randomBytes(ROTATION_ID_BYTES).toString('hex');
  // ~5 minute deprecation window for consumers to pick up the new secret.
  const validUntil = new Date(Date.now() + 5 * 60 * 1000);
  return { epochId, previousEpochId, validUntil };
}

/**
 * Select the signing secret to use when delivering a webhook.
 *
 * Returns the current secret, or — while the deprecation window is still open —
 * the previous secret. This lets delivery keep succeeding for consumers that
 * have not yet picked up the new secret after a rotation. Returns null when the
 * webhook has no usable secret.
 */
export function resolveWebhookSecretAtDelivery(webhook: {
 secret: string;
 previousWebhookSecret: string | null | undefined;
 webhookSecretId: string | null | undefined;
 previousWebhookSecretId: string | null | undefined;
 webhookSecretValidUntil: Date | null | undefined;
}): string | null {
 if (!webhook.secret) {
   return null;
 }

  const currentEpoch = parseWebhookSecretEpoch(webhook.webhookSecretId);
  const previousEpoch = parseWebhookSecretEpoch(webhook.previousWebhookSecretId);

  // If the current secret is new (no previous epoch yet), use it directly.
  if (!currentEpoch || !previousEpoch) {
    return webhook.secret;
  }

  // If the previous secret is present and still within the deprecation window,
  // use it so consumers that have not migrated can still verify.
  if (webhook.previousWebhookSecret && webhook.webhookSecretValidUntil) {
    if (new Date().getTime() <= webhook.webhookSecretValidUntil.getTime()) {
      return webhook.previousWebhookSecret;
    }
  }

  return webhook.secret;
}
