import {
  parseWebhookSecretEpoch,
  isWebhookSecretRotationValid,
  rotateWebhookSecret,
  resolveWebhookSecretAtDelivery,
} from '../services/webhookSecretRotation';

describe('webhookSecretRotation', () => {
  describe('parseWebhookSecretEpoch', () => {
    test('accepts a valid 8-hex epoch', () => {
      expect(parseWebhookSecretEpoch('ab12cd34')).toBe('ab12cd34');
    });
    test('rejects invalid epochs', () => {
      expect(parseWebhookSecretEpoch('')).toBeNull();
      expect(parseWebhookSecretEpoch('TOOSHORT')).toBeNull();
      expect(parseWebhookSecretEpoch('zzzzzzzz')).toBeNull();
      expect(parseWebhookSecretEpoch(null)).toBeNull();
    });
  });

  describe('isWebhookSecretRotationValid', () => {
    const rotated = {
      webhookSecretId: 'abcdef01',
      previousWebhookSecretId: '12345678',
      webhookSecretValidUntil: new Date(Date.now() + 60_000),
    };

    test('accepts the current epoch', () => {
      expect(
        isWebhookSecretRotationValid('abcdef01', rotated, new Date())
      ).toBe(true);
    });

    test('accepts the previous epoch inside the deprecation window', () => {
      expect(
        isWebhookSecretRotationValid('12345678', rotated, new Date())
      ).toBe(true);
    });

    test('rejects the previous epoch after the window closes', () => {
      expect(
        isWebhookSecretRotationValid('12345678', rotated, new Date(Date.now() + 120_000))
      ).toBe(false);
    });

    test('accepts any non-empty epoch when the webhook never rotated', () => {
      const neverRotated = {
        webhookSecretId: null,
        previousWebhookSecretId: null,
        webhookSecretValidUntil: null,
      };
      expect(isWebhookSecretRotationValid('anything', neverRotated, new Date())).toBe(true);
      expect(isWebhookSecretRotationValid('', neverRotated, new Date())).toBe(false);
    });

    test('rejects an unknown epoch', () => {
      expect(
        isWebhookSecretRotationValid('deadbe', rotated, new Date())
      ).toBe(false);
    });
  });

  describe('rotateWebhookSecret', () => {
    test('produces distinct epochs each call', () => {
      const a = rotateWebhookSecret();
      const b = rotateWebhookSecret();
      expect(a.epochId).not.toBe(b.epochId);
      expect(a.previousEpochId).not.toBe(b.previousEpochId);
    });

    test('validUntil is roughly 5 minutes in the future', () => {
      const before = Date.now();
      const { validUntil } = rotateWebhookSecret();
      const after = Date.now();
      expect(validUntil.getTime()).toBeGreaterThan(before + 4 * 60_000);
      expect(validUntil.getTime()).toBeLessThan(after + 6 * 60_000);
    });
  });

  describe('resolveWebhookSecretAtDelivery', () => {
    test('returns the current secret when never rotated', () => {
      const webhook = {
        secret: 's-current',
        previousWebhookSecret: null,
        webhookSecretId: null,
        previousWebhookSecretId: null,
        webhookSecretValidUntil: null,
      };
      expect(resolveWebhookSecretAtDelivery(webhook)).toBe('s-current');
    });

    test('returns the previous secret inside the deprecation window', () => {
      const webhook = {
        secret: 's-current',
        previousWebhookSecret: 's-previous',
        webhookSecretId: 'abcdef01',
        previousWebhookSecretId: '12345678',
        webhookSecretValidUntil: new Date(Date.now() + 60_000),
      };
      expect(resolveWebhookSecretAtDelivery(webhook)).toBe('s-previous');
    });

    test('returns the current secret after the deprecation window', () => {
      const webhook = {
        secret: 's-current',
        previousWebhookSecret: 's-previous',
        webhookSecretId: 'abcdef01',
        previousWebhookSecretId: '12345678',
        webhookSecretValidUntil: new Date(Date.now() - 1000),
      };
      expect(resolveWebhookSecretAtDelivery(webhook)).toBe('s-current');
    });

    test('returns null when there is no secret', () => {
      const webhook = {
        secret: '',
        previousWebhookSecret: null,
        webhookSecretId: null,
        previousWebhookSecretId: null,
        webhookSecretValidUntil: null,
      };
      expect(resolveWebhookSecretAtDelivery(webhook)).toBeNull();
    });
  });
});
