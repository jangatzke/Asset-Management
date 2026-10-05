/**
 * Tests for credentialEncryption.service.ts decrypt() hardening (S6).
 */
import { encrypt, decrypt } from '../services/credentialEncryption.service';

describe('credentialEncryption decrypt() plaintext passthrough (S6)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS;
    else process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS = originalFlag;
  });

  it('round-trips encrypt/decrypt with the configured key', () => {
    const value = 'sup3r-s3cret-password';
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it('returns undecryptable values as-is outside production (backward compat)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS;
    const legacy = 'plaintext-from-before-encryption';
    expect(decrypt(legacy)).toBe(legacy);
  });

  it('throws instead of passing through in production without the opt-in flag', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS;
    expect(() => decrypt('plaintext-from-before-encryption')).toThrow(/could not be decrypted/);
  });

  it('passes through in production only with ALLOW_LEGACY_PLAINTEXT_SECRETS=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS = 'true';
    const legacy = 'plaintext-from-before-encryption';
    expect(decrypt(legacy)).toBe(legacy);
  });

  it('throws for ciphertext that fails with all keys in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_LEGACY_PLAINTEXT_SECRETS;
    // Long enough to look like ciphertext but not decryptable with any key.
    const fake = Buffer.from([0x01, ...new Array(40).fill(0xab)]).toString('base64');
    expect(() => decrypt(fake)).toThrow(/could not be decrypted/);
  });
});
