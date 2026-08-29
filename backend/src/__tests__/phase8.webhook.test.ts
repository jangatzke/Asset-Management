import { 
  generateHmacSignature, 
  verifyHmacSignature,
  deliverWebhook,
  deliverWebhookWithRetry,
  WebhookPayload,
  WebhookEvent
} from '../services/webhook.service';
import axios from 'axios';
import crypto from 'crypto';

jest.mock('axios');

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('Webhook Service', () => {
  describe('generateHmacSignature', () => {
    test('should generate a valid HMAC signature', () => {
      const secret = 'test-secret-123';
      const payload: WebhookPayload = {
        id: 'evt-123',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: { assetId: 'asset-456' },
      };

      const signature = generateHmacSignature(secret, payload);

      // Should start with t=<timestamp>,s=<hex>
      expect(signature).toMatch(/^t=\d+,s=[a-f0-9]+$/);
    });

    test('should generate different signatures for different payloads', () => {
      const secret = 'test-secret';
      const payload1: WebhookPayload = { id: 'evt-1', type: 'asset.created' as WebhookEvent, data: { id: 1 }, timestamp: new Date().toISOString() };
      const payload2: WebhookPayload = { id: 'evt-2', type: 'asset.updated' as WebhookEvent, data: { id: 2 }, timestamp: new Date().toISOString() };
      const signingTimestamp = 1_704_067_200_000;

      expect(generateHmacSignature(secret, payload1, signingTimestamp)).not.toBe(
        generateHmacSignature(secret, payload2, signingTimestamp)
      );
    });

    test('should generate the same signature for the same secret, payload, and timestamp', () => {
      const secret = 'test-secret';
      const signingTimestamp = 1_704_067_200_000;
      const payload: WebhookPayload = {
        id: 'evt-123',
        type: 'asset.created' as WebhookEvent,
        timestamp: '2024-01-01T00:00:00.000Z',
        data: { assetId: 'asset-456' },
      };

      expect(generateHmacSignature(secret, payload, signingTimestamp)).toBe(
        generateHmacSignature(secret, payload, signingTimestamp)
      );
    });
  });

  describe('verifyHmacSignature', () => {
    test('should verify a valid signature', () => {
      const secret = 'my-secret-key';
      const payload: WebhookPayload = { id: 'test', type: 'system.health.check' as WebhookEvent, data: {}, timestamp: new Date().toISOString() };
      
      const signature = generateHmacSignature(secret, payload);
      expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
    });

    test('should reject an invalid signature', () => {
      const secret = 'my-secret-key';
      const payload: WebhookPayload = { id: 'test', type: 'system.health.check' as WebhookEvent, data: {}, timestamp: new Date().toISOString() };
      
      expect(verifyHmacSignature(secret, payload, 't=123,s=invalid')).toBe(false);
    });

    test('should reject signature with wrong secret', () => {
      const secret1 = 'secret-a';
      const secret2 = 'secret-b';
      const payload: WebhookPayload = { id: 'test', type: 'system.health.check' as WebhookEvent, data: {}, timestamp: new Date().toISOString() };
      
      const signature = generateHmacSignature(secret1, payload);
      expect(verifyHmacSignature(secret2, payload, signature)).toBe(false);
    });

    test('should reject malformed signatures', () => {
      const payload: WebhookPayload = { id: 'test', type: 'system.health.check' as WebhookEvent, data: {}, timestamp: new Date().toISOString() };
      expect(verifyHmacSignature('secret', payload, '')).toBe(false);
      expect(verifyHmacSignature('secret', payload, 'invalid-format')).toBe(false);
    });

    test('should reject a validly signed timestamp beyond the permitted future clock skew', () => {
      const secret = 'my-secret-key';
      const now = 1_700_000_000_000;
      const futureTimestamp = now + (5 * 60 * 1000) + 1;
      const payload: WebhookPayload = {
        id: 'test',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date(now).toISOString(),
        data: {},
      };
      const canonicalPayload = JSON.stringify({
        data: {},
        id: payload.id,
        timestamp: payload.timestamp,
        type: payload.type,
      });
      // nosemgrep: javascript.lang.security.audit.hardcoded-hmac-key.hardcoded-hmac-key
      // Deterministic test-only HMAC key; never used in production code paths.
      const digest = crypto.createHmac('sha256', secret)
        .update(`${futureTimestamp}.${canonicalPayload}`)
        .digest('hex');

      jest.spyOn(Date, 'now').mockReturnValue(now);
      expect(verifyHmacSignature(secret, payload, `t=${futureTimestamp},s=${digest}`)).toBe(false);
      jest.restoreAllMocks();
    });

    test('should fall back to the secure default age for a non-finite runtime max age', () => {
      const secret = 'my-secret-key';
      const now = 1_700_000_000_000;
      const oldTimestamp = now - (6 * 60 * 1000);
      const payload: WebhookPayload = {
        id: 'test',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date(oldTimestamp).toISOString(),
        data: {},
      };
      const canonicalPayload = JSON.stringify({
        data: {},
        id: payload.id,
        timestamp: payload.timestamp,
        type: payload.type,
      });
      // nosemgrep: javascript.lang.security.audit.hardcoded-hmac-key.hardcoded-hmac-key
      // Deterministic test-only HMAC key; never used in production code paths.
      const digest = crypto.createHmac('sha256', secret)
        .update(`${oldTimestamp}.${canonicalPayload}`)
        .digest('hex');

      jest.spyOn(Date, 'now').mockReturnValue(now);
      expect(verifyHmacSignature(secret, payload, `t=${oldTimestamp},s=${digest}`, Number.NaN)).toBe(false);
      jest.restoreAllMocks();
    });
  });

  describe('deliverWebhook', () => {
    beforeEach(() => {
      mockedAxios.mockReset();
    });

    test('should return success structure for valid delivery attempt', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      mockedAxios.mockResolvedValue({ status: 204 } as any);

      const result = await deliverWebhook(payload, { url: 'https://example.invalid/webhook', secret: 'test-secret', timeoutMs: 1000 });
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('attemptNumber', 1);
      expect(result).toHaveProperty('durationMs');
    });

    test('should include error message on failure', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      mockedAxios.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await deliverWebhook(payload, { url: 'https://example.invalid/test', secret: 'test-secret', timeoutMs: 2000 });
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    test('should sign the exact canonical JSON body and expose the same millisecond timestamp in both headers', async () => {
      const timestamp = 1_700_000_000_123;
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date(timestamp).toISOString(),
        data: { z: 2, a: 1 },
      };
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      mockedAxios.mockResolvedValue({ status: 200 } as any);

      await deliverWebhook(payload, { url: 'https://example.invalid/webhook', secret: 'test-secret' });

      const request = mockedAxios.mock.calls[0][0] as any;
      const canonicalBody = JSON.stringify({
        data: { a: 1, z: 2 },
        id: payload.id,
        timestamp: payload.timestamp,
        type: payload.type,
      });
      // nosemgrep: javascript.lang.security.audit.hardcoded-hmac-key.hardcoded-hmac-key
      // Deterministic test-only HMAC key; never used in production code paths.
      const expectedDigest = crypto.createHmac('sha256', 'test-secret')
        .update(`${timestamp}.${canonicalBody}`)
        .digest('hex');

      expect(request.data).toBe(canonicalBody);
      expect(request.headers['X-Webhook-Timestamp']).toBe(String(timestamp));
      expect(request.headers['X-Webhook-Signature']).toBe(`t=${timestamp},s=${expectedDigest}`);
      jest.restoreAllMocks();
    });
  });

  describe('deliverWebhookWithRetry', () => {
    beforeEach(() => {
      mockedAxios.mockReset();
      mockedAxios.mockRejectedValue(new Error('connect ECONNREFUSED'));
    });

    test('should return failure after max retries for invalid URL', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      const result = await deliverWebhookWithRetry(payload, {
              url: 'https://example.invalid/test',
              secret: 'test-secret',
              maxRetries: 2,
              timeoutMs: 500
            });
      
      expect(result.success).toBe(false);
      expect(mockedAxios).toHaveBeenCalledTimes(2);
    }, 15000);

    test('should have attemptNumber reflecting retries', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      const result = await deliverWebhookWithRetry(payload, {
              url: 'https://example.invalid/test',
              secret: 'test-secret',
              maxRetries: 1,
              timeoutMs: 500
            });
      
      expect(result.attemptNumber).toBeGreaterThanOrEqual(1);
    }, 5000);
  });
});
