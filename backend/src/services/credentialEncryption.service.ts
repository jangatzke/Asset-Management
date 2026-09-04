/**
 * Credential Encryption Service
 *
 * Provides AES-256-GCM encryption/decryption for sensitive credentials
 * stored in the database (IMAP/SMTP passwords, Exchange client secrets).
 *
 * Configuration:
 *  - CREDENTIAL_ENCRYPTION_KEY: Required. Hex-encoded 32-byte (256-bit) key.
 *    Generate with: `openssl rand -hex 32`
 *  - CREDENTIAL_ENCRYPTION_KEYS (optional): Comma-separated list of hex-encoded
 *    keys for key rotation support.  The first key is the *active* key used for
 *    encryption.  All keys in the list are tried during decryption, allowing
 *    seamless rotation without re-encrypting existing data.
 *
 * Format: <key_version_byte><12-byte IV><16-byte auth tag><ciphertext>
 *   - key_version_byte: 0x01 = current active key (written on encrypt)
 *   - IV: 12-byte random nonce
 *   - Auth tag: 16 bytes (AES-GCM)
 *   - Ciphertext: variable length
 *   - Combined: base64-encoded
 *
 * Key rotation workflow:
 *  1. Add the new key to CREDENTIAL_ENCRYPTION_KEYS (or keep it as
 *     CREDENTIAL_ENCRYPTION_KEY for single-key setups).
 *  2. Restart the service.  The first key is active for encryption.
 *  3. Existing data encrypted with older keys can still be decrypted.
 *  4. (Optional) Run a migration to re-encrypt data with the new key.
 */

import crypto from 'crypto';

/** Number of bytes for the IV (nonce) per encryption */
const IV_LENGTH = 12;
/** AES-GCM tag length is always 16 bytes */
const AUTH_TAG_LENGTH = 16;
/** Version byte length */
const VERSION_BYTE_LENGTH = 1;
/** Total overhead: version byte + IV + auth tag */
const CIPHER_OVERHEAD = VERSION_BYTE_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
/** Current encryption format version (written as the leading byte) */
const CURRENT_VERSION = 0x01;

/**
 * Resolve active encryption key(s).
 *
 * Supports single-key (CREDENTIAL_ENCRYPTION_KEY) and multi-key
 * (CREDENTIAL_ENCRYPTION_KEYS, comma-separated) configurations.
 * The first key in the list is always the active encryption key.
 */
function resolveKeys(): Buffer[] {
  const single = process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';
  const multi = process.env.CREDENTIAL_ENCRYPTION_KEYS;

  const all: string[] = [];

  if (multi && multi.trim().length > 0) {
    // Multi-key mode: comma-separated hex strings
    all.push(...multi.split(',').map((k) => k.trim()).filter((k) => k.length > 0));
  } else if (single.length > 0) {
    // Single-key mode
    all.push(single);
  }

  return all
    .filter((hex) => hex.length === 64 && /^[0-9a-f]{64}$/i.test(hex))
    .map((hex) => Buffer.from(hex, 'hex'));
}

const ENCRYPTION_KEYS: Buffer[] = resolveKeys();

/** The active (first) encryption key buffer. */
const ENCRYPTION_KEY: Buffer | undefined = ENCRYPTION_KEYS.length > 0 ? ENCRYPTION_KEYS[0] : undefined;

/** Flag indicating whether at least one valid key is configured. */
export const ENCRYPTION_AVAILABLE: boolean = ENCRYPTION_KEYS.length > 0;

/** Number of configured valid keys. */
export const ENCRYPTION_KEY_COUNT: number = ENCRYPTION_KEYS.length;

// Fail fast if no valid encryption key is configured.
// Using a zero key or falling back to JWT_SECRET would allow attackers to
// decrypt credentials stored in the database — never do this silently.
if (!ENCRYPTION_AVAILABLE) {
  console.error(
    '[credentialEncryption] FATAL: CREDENTIAL_ENCRYPTION_KEY is missing or invalid. ' +
    'Credentials cannot be encrypted/decrypted. Generate with: openssl rand -hex 32',
  );
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY is required in production mode. ' +
      'Generate with: openssl rand -hex 32',
    );
  }
}

/**
 * Encrypt a plaintext string.
 * Returns Base64-encoded `<version_byte><nonce><auth_tag><ciphertext>`.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  if (!ENCRYPTION_KEY) throw new Error('Credential encryption is unavailable because no valid encryption key is configured.');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: version (1 byte) + nonce (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([Buffer.from([CURRENT_VERSION]), iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a Base64-encoded `<version><nonce><auth_tag><ciphertext>` string.
 *
 * Tries all configured keys (starting with the active key) to support key
 * rotation.  Returns the original plaintext on first successful decryption.
 *
 * Falls back to plaintext if decryption fails (backward compatibility with
 * pre-encryption storage).
 */
export function decrypt(base64Data: string): string {
  if (!base64Data) return '';

  const combined = Buffer.from(base64Data, 'base64');

  // The legacy format omitted the version byte: <IV><auth tag><ciphertext>.
  // Keep it readable while writing only the current versioned format.
  const isVersioned = combined[0] === CURRENT_VERSION;
  const overhead = isVersioned ? CIPHER_OVERHEAD : IV_LENGTH + AUTH_TAG_LENGTH;
  if (combined.length < overhead + 1) {
    // Likely plaintext or too short — return as-is
    return base64Data;
  }

  const offset = isVersioned ? VERSION_BYTE_LENGTH : 0;

  // Try each configured key in order (active key first, then legacy keys)
  for (const key of ENCRYPTION_KEYS) {
    try {
      const iv = combined.slice(offset, offset + IV_LENGTH);
      const authTag = combined.slice(offset + IV_LENGTH, offset + IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = combined.slice(offset + IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      // Wrong key or corrupted data — try next key
      continue;
    }
  }

  // Decryption failed with all keys — return as-is for backward compatibility
  console.warn('[credentialEncryption] decrypt() failed for all configured keys — returning stored value as-is');
  return base64Data;
}

/**
 * Check if a stored value is encrypted (has the expected base64 length format).
 * Used to determine if decryption is needed on read.
 *
 * Updated for the new format with version byte:
 *   <version_byte><12-byte IV><16-byte auth tag><ciphertext>
 * Minimum total length: 1 + 12 + 16 + 1 = 30 bytes decoded (~40 base64 chars).
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false;
  try {
    const buffer = Buffer.from(value, 'base64');
    const isVersioned = buffer[0] === CURRENT_VERSION;
    const overhead = isVersioned ? CIPHER_OVERHEAD : IV_LENGTH + AUTH_TAG_LENGTH;
    return buffer.length >= overhead + 1;
  } catch {
    return false;
  }
}
