import { 
  generateHmacSignature, 
  verifyHmacSignature,
  deliverWebhook,
  deliverWebhookWithRetry,
  WebhookPayload,
  WebhookEvent
} from '../services/webhook.service';
import axios from 'axios';

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

      expect(generateHmacSignature(secret, payload1)).not.toBe(
        generateHmacSignature(secret, payload2)
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
