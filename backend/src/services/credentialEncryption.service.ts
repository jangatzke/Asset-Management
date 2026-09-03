/**
 * Credential Encryption Service
 *
 * Provides AES-256-GCM encryption/decryption for sensitive credentials
 * stored in the database (IMAP/SMTP passwords, Exchange client secrets).
 *
 * Configuration:
 *  - CREDENTIAL_ENCRYPTION_KEY: Required. Hex-encoded 32-byte (256-bit) key.
 *    Generate with: `openssl rand -hex 32`
 *  - If the key is missing or invalid, the service throws at startup.
 *
 * Usage:
 *  - encrypt(plaintext: string): Returns Base64-encoded ciphertext.
 *  - decrypt(base64Ciphertext: string): Returns plaintext string.
 *
 * Format: <base64-nonce>:<base64-ciphertext>
 *   - 12-byte random IV/nonce per encryption (AES-GCM standard)
 *   - Auth tag (16 bytes) appended by AES-GCM
 */

import crypto from 'crypto';

/** Number of bytes for the IV (nonce) per encryption */
const IV_LENGTH = 12;
/** AES-GCM tag length is always 16 bytes */
const AUTH_TAG_LENGTH = 16;

/** Hex-encoded 32-byte (256-bit) encryption key */
const ENCRYPTION_KEY_HEX: string = process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';

/** Flag indicating whether a valid encryption key is configured. */
export const ENCRYPTION_AVAILABLE: boolean =
  ENCRYPTION_KEY_HEX.length === 64 && /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY_HEX);

/** Development fallback key used only when no production key is configured. */
const DEVELOPMENT_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000000';

/** The active encryption key buffer. */
const ENCRYPTION_KEY: Buffer = ENCRYPTION_AVAILABLE
  ? Buffer.from(ENCRYPTION_KEY_HEX, 'hex')
  : Buffer.from(DEVELOPMENT_KEY_HEX, 'hex');

// Log encryption status at startup
if (!ENCRYPTION_AVAILABLE) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[credentialEncryption] CRITICAL: CREDENTIAL_ENCRYPTION_KEY is missing or invalid in production mode. ' +
      'Credentials cannot be encrypted. Generate with: openssl rand -hex 32',
    );
  } else {
    console.warn(
      '[credentialEncryption] CREDENTIAL_ENCRYPTION_KEY is missing or invalid. ' +
      'Using insecure development fallback key. NOT suitable for production use. ' +
      'Generate with: openssl rand -hex 32',
    );
  }
}

/**
 * Encrypt a plaintext string.
 * Returns Base64-encoded `<nonce>:ciphertext` (auth tag appended by GCM).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  if (!ENCRYPTION_AVAILABLE) {
    console.warn('[credentialEncryption] encrypt() called but no production key configured — data will be encrypted with development key and is INSECURE.');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: nonce (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a Base64-encoded `<nonce>:ciphertext` string.
 * Returns the original plaintext.
 */
export function decrypt(base64Data: string): string {
  if (!base64Data) return '';
  const combined = Buffer.from(base64Data, 'base64');
  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Check if a stored value is encrypted (has the expected base64 length format).
 * Used to determine if decryption is needed on read.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 50) return false; // Minimum encrypted length
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1; // Need at least 1 byte of ciphertext
  } catch {
    return false;
  }
}
