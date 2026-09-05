/**
 * Service-account token rotation helpers.
 *
 * A service-account access token has one of two wire formats:
 *
 *   Legacy: svc_<uuid>_<random>
 *   New:    svc_<uuid>_<rotationId>_<random>
 *
 * where:
 *   - `<uuid>` is the ServiceAccount database id (the lookup key),
 *   - `<rotationId>` is a short opaque epoch that changes on every token
 *     rotation (only present in the new format), and
 *   - `<random>` is the high-entropy secret material that is hashed (with a
 *     server-side salt) before being persisted.
 *
 * Rotating a token means issuing a token whose `<rotationId>` no longer matches
 * the account's `tokenRotationId`. Tokens minted during a short deprecation
 * window (identified by `previousTokenRotationId` + `tokenRotationValidUntil`)
 * are still accepted so consumers can migrate, but once the window elapses the
 * stale token is rejected outright.
 */

import crypto from 'crypto';

/** Rotation ids are 4 random bytes rendered as 8 hex characters. */
const ROTATION_ID_BYTES = 4;

const ROTATION_ID_REGEX = /^[0-9a-f]{8}$/;

/**
 * Parse and structurally validate a service-account token.
 *
 * Supports both the legacy 3-part format (no rotation epoch) and the new
 * 4-part format (with a rotation epoch). Returns `null` when the token does
 * not match either shape so callers can return a uniform "invalid token"
 * response instead of leaking which component was malformed.
 */
export function parseServiceAccountToken(
  token: string
): { id: string; rotationId: string; random: string } | null {
  if (typeof token !== 'string') {
    return null;
  }

  const parts = token.split('_');
  if (parts.length < 3 || parts[0] !== 'svc') {
    return null;
  }

  const id = parts[1];
  const random = parts.slice(2).join('_');

  if (!id || random.length < 16) {
    return null;
  }

  // New format carries a rotation epoch as the second component.
  if (parts.length >= 4 && ROTATION_ID_REGEX.test(parts[2])) {
    return { id, rotationId: parts[2], random: parts.slice(3).join('_') };
  }

  // Legacy format has no rotation epoch.
  return { id, rotationId: '', random };
}

/**
 * Decide whether a token is still usable for the account.
 *
 * @param tokenRotationId The rotation epoch embedded in the token (empty string
 *   for the legacy 3-part format).
 * @param account         The account's current rotation state.
 * @param now             Reference time (injectable for tests).
 *
 * Rules:
 *  - If the account has never rotated, any well-formed token is accepted
 *    (backward compatibility with tokens minted before rotation existed).
 *  - The token's epoch matches the account's current epoch.
 *  - The token's epoch is the account's previous epoch and the deprecation
 *    window (previousTokenRotationId + tokenRotationValidUntil) is still open.
 */
export function isServiceAccountTokenValid(
  tokenRotationId: string,
  account: {
    tokenRotationId: string | null | undefined;
    previousTokenRotationId: string | null | undefined;
    tokenRotationValidUntil: Date | null | undefined;
  },
  now: Date = new Date()
): boolean {
  const hasRotationState = !!(account.tokenRotationId || account.previousTokenRotationId);
  if (!hasRotationState) {
    // Account never rotated — accept any well-formed token.
    return true;
  }

  if (tokenRotationId && tokenRotationId === account.tokenRotationId) {
    // Current epoch.
    return true;
  }

  if (tokenRotationId && tokenRotationId === account.previousTokenRotationId) {
    // Previous epoch — only acceptable while the deprecation window is open.
    return !!account.tokenRotationValidUntil &&
      now.getTime() <= account.tokenRotationValidUntil.getTime();
  }

  return false;
}

/**
 * Rotate a service account's token. Returns the new rotation epoch together
 * with the deprecation parameters that must be persisted on the account so the
 * previous token keeps working for a short window.
 */
export function rotateServiceAccountToken(): {
  rotationId: string;
  previousRotationId: string;
  validUntil: Date;
} {
  const rotationId = crypto.randomBytes(ROTATION_ID_BYTES).toString('hex');
  const previousRotationId = crypto.randomBytes(ROTATION_ID_BYTES).toString('hex');
  // ~5 minute deprecation window for consumers to pick up the new token.
  const validUntil = new Date(Date.now() + 5 * 60 * 1000);
  return { rotationId, previousRotationId, validUntil };
}
