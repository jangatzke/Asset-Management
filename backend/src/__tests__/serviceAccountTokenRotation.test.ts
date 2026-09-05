import {
  parseServiceAccountToken,
  isServiceAccountTokenValid,
  rotateServiceAccountToken,
} from '../services/serviceAccountTokenRotation';

const UUID = '12345678-1234-1234-1234-123456789abc';

describe('serviceAccountTokenRotation', () => {
  describe('parseServiceAccountToken', () => {
    test('parses the new 4-part format with rotation epoch', () => {
      const token = `svc_${UUID}_ab12cd34_${'x'.repeat(32)}`;
      const parsed = parseServiceAccountToken(token);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(UUID);
      expect(parsed!.rotationId).toBe('ab12cd34');
      expect(parsed!.random).toHaveLength(32);
    });

    test('parses the legacy 3-part format without rotation epoch', () => {
      const token = `svc_${UUID}_${'x'.repeat(32)}`;
      const parsed = parseServiceAccountToken(token);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(UUID);
      expect(parsed!.rotationId).toBe('');
      expect(parsed!.random).toHaveLength(32);
    });

    test('rejects malformed tokens', () => {
      expect(parseServiceAccountToken('')).toBeNull();
      expect(parseServiceAccountToken('svc')).toBeNull();
      expect(parseServiceAccountToken('not-a-token')).toBeNull();
      expect(parseServiceAccountToken(`svc_${UUID}_${'x'.repeat(8)}`)).toBeNull();
    });
  });

  describe('isServiceAccountTokenValid', () => {
    const account = {
      tokenRotationId: 'current0',
      previousTokenRotationId: 'previou0',
      tokenRotationValidUntil: new Date(Date.now() + 60_000),
    };

    test('accepts a token matching the current rotation epoch', () => {
      expect(
        isServiceAccountTokenValid('current0', account, new Date())
      ).toBe(true);
    });

    test('accepts a previous-epoch token inside the deprecation window', () => {
      expect(
        isServiceAccountTokenValid('previou0', account, new Date())
      ).toBe(true);
    });

    test('rejects a previous-epoch token after the window closes', () => {
      const afterWindow = new Date(Date.now() + 120_000);
      expect(
        isServiceAccountTokenValid('previou0', account, afterWindow)
      ).toBe(false);
    });

    test('rejects an unknown rotation epoch', () => {
      expect(
        isServiceAccountTokenValid('unknown0', account, new Date())
      ).toBe(false);
    });

    test('accepts any well-formed token when the account never rotated', () => {
      const neverRotated = {
        tokenRotationId: null,
        previousTokenRotationId: null,
        tokenRotationValidUntil: null,
      };
      expect(
        isServiceAccountTokenValid('', neverRotated, new Date())
      ).toBe(true);
      expect(
        isServiceAccountTokenValid('whatever', neverRotated, new Date())
      ).toBe(true);
    });

    test('rejects a previous-epoch token when no window was set', () => {
      const noWindow = {
        tokenRotationId: 'current0',
        previousTokenRotationId: 'previou0',
        tokenRotationValidUntil: null,
      };
      expect(
        isServiceAccountTokenValid('previou0', noWindow, new Date())
      ).toBe(false);
    });
  });

  describe('rotateServiceAccountToken', () => {
    test('produces distinct rotation epochs each call', () => {
      const a = rotateServiceAccountToken();
      const b = rotateServiceAccountToken();
      expect(a.rotationId).not.toBe(b.rotationId);
      expect(a.previousRotationId).not.toBe(b.previousRotationId);
    });

    test('validUntil is roughly 5 minutes in the future', () => {
      const before = Date.now();
      const { validUntil } = rotateServiceAccountToken();
      const after = Date.now();
      expect(validUntil.getTime()).toBeGreaterThan(before + 4 * 60_000);
      expect(validUntil.getTime()).toBeLessThan(after + 6 * 60_000);
    });
  });
});
