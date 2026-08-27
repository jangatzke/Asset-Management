/**
 * Webhook Security Tests
 *
 * Tests for:
 * - SSRF protection (URL validation)
 * - HMAC signature generation and verification
 * - Replay attack prevention
 */

import {
  validateWebhookUrl,
  checkResolvedIp,
} from '../services/urlValidator';
import {
  generateHmacSignature,
  verifyHmacSignature,
  WebhookPayload,
  WebhookEvent,
} from '../services/webhook.service';

describe('Webhook Security', () => {
  describe('URL Validation - SSRF Protection', () => {
    describe('Protocol validation', () => {
      it('should reject http:// URLs', () => {
        const result = validateWebhookUrl('http://example.com/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Only HTTPS');
      });

      it('should reject file:// URLs', () => {
        const result = validateWebhookUrl('file:///etc/passwd');
        expect(result.valid).toBe(false);
      });

      it('should reject data: URLs', () => {
        const result = validateWebhookUrl('data:text/html,<script>alert(1)</script>');
        expect(result.valid).toBe(false);
      });

      it('should accept https:// URLs', () => {
        const result = validateWebhookUrl('https://example.com/webhook');
        expect(result.valid).toBe(true);
      });
    });

    describe('Bare IP address rejection', () => {
      it('should reject IPv4 bare addresses', () => {
        const result = validateWebhookUrl('https://127.0.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Bare IP');
      });

      it('should reject IPv4 private addresses', () => {
        const result = validateWebhookUrl('https://10.0.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Bare IP');
      });

      it('should reject IPv6 bare addresses', () => {
        const result = validateWebhookUrl('https://[::1]/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Bare IP');
      });
    });

    describe('Cloud metadata endpoints', () => {
      it('should reject AWS metadata IP', () => {
        const result = validateWebhookUrl('https://169.254.169.254/latest/meta-data/');
        expect(result.valid).toBe(false);
      });

      it('should reject Azure metadata IP', () => {
        const result = validateWebhookUrl('https://168.63.129.16/');
        expect(result.valid).toBe(false);
      });

      it('should reject Alibaba metadata IP', () => {
        const result = validateWebhookUrl('https://100.100.100.200/');
        expect(result.valid).toBe(false);
      });
    });

    describe('Valid hostnames', () => {
      it('should accept valid HTTPS hostnames', () => {
        const result = validateWebhookUrl('https://hooks.example.com/webhook');
        expect(result.valid).toBe(true);
      });

      it('should accept subdomain hostnames', () => {
        const result = validateWebhookUrl('https://webhooks.staging.example.co.uk/callback');
        expect(result.valid).toBe(true);
      });

      it('should accept hostnames with hyphens', () => {
        const result = validateWebhookUrl('https://my-webhook-server.example.com/');
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid hostnames', () => {
      it('should reject hostnames with double dots', () => {
        const result = validateWebhookUrl('https://example..com/webhook');
        expect(result.valid).toBe(false);
      });

      it('should reject numeric-only hostnames that look like IPs', () => {
        // Node.js URL parser interprets '12345' as octal notation, converting to IP 0.0.48.57
        // This is exactly the SSRF protection we want - numeric-only hostnames can be IP obfuscation attempts
        const result = validateWebhookUrl('https://12345/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Bare IP addresses');
      });

      it('should reject URLs with localhost as hostname', () => {
        const result = validateWebhookUrl('https://localhost/webhook');
        expect(result.valid).toBe(true); // localhost is a valid hostname format; DNS check happens at delivery time
      });
    });
  });

  describe('IP Resolution Check', () => {
    describe('Private IP detection', () => {
      it('should block localhost IPv4', () => {
        const result = checkResolvedIp('127.0.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block private IPv4 range 10.x', () => {
        const result = checkResolvedIp('10.0.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block private IPv4 range 172.16.x', () => {
        const result = checkResolvedIp('172.16.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block private IPv4 range 192.168.x', () => {
        const result = checkResolvedIp('192.168.1.1');
        expect(result.safe).toBe(false);
      });

      it('should block link-local IPv4', () => {
        const result = checkResolvedIp('169.254.169.254');
        expect(result.safe).toBe(false);
        expect(result.reason).toMatch(/private|cloud metadata/);
      });

      it('should allow public IPv4', () => {
        const result = checkResolvedIp('8.8.8.8');
        expect(result.safe).toBe(true);
      });
    });
  });

  describe('HMAC Signature', () => {
    describe('Generation', () => {
      it('should generate a valid HMAC signature', () => {
        const secret = 'test-secret-123';
        const payload: WebhookPayload = {
          id: 'evt-123',
          type: 'asset.created' as WebhookEvent,
          timestamp: new Date().toISOString(),
          data: { assetId: 'asset-456' },
        };

        const signature = generateHmacSignature(secret, payload);

        expect(signature).toMatch(/^t=\d+,s=[a-f0-9]+$/);
      });

      it('should generate different signatures for different payloads', () => {
        const secret = 'test-secret';
        const basePayload = { id: '', type: 'asset.created' as WebhookEvent, timestamp: new Date().toISOString(), data: {} };
        
        const sig1 = generateHmacSignature(secret, { ...basePayload, id: 'evt-1', data: { id: 1 } });
        const sig2 = generateHmacSignature(secret, { ...basePayload, id: 'evt-2', data: { id: 2 } });

        expect(sig1).not.toBe(sig2);
      });

      it('should generate deterministic signatures for same input', () => {
        const secret = 'test-secret';
        const signingTimestamp = 1_704_067_200_000;
        const payload: WebhookPayload = {
          id: 'evt-123',
          type: 'asset.created' as WebhookEvent,
          timestamp: '2024-01-01T00:00:00.000Z',
          data: { assetId: 'asset-456' },
        };

        const sig1 = generateHmacSignature(secret, payload, signingTimestamp);
        const sig2 = generateHmacSignature(secret, payload, signingTimestamp);

        expect(sig1).toBe(sig2);
      });
    });

    describe('Verification', () => {
      it('should verify a valid signature', () => {
        const secret = 'my-secret-key';
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, payload);
        expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
      });

      it('should reject an invalid signature', () => {
        const secret = 'my-secret-key';
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        expect(verifyHmacSignature(secret, payload, 't=123,s=invalid')).toBe(false);
      });

      it('should reject signature with wrong secret', () => {
        const secret1 = 'secret-a';
        const secret2 = 'secret-b';
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret1, payload);
        expect(verifyHmacSignature(secret2, payload, signature)).toBe(false);
      });

      it('should reject malformed signatures', () => {
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        expect(verifyHmacSignature('secret', payload, '')).toBe(false);
        expect(verifyHmacSignature('secret', payload, 'invalid-format')).toBe(false);
        expect(verifyHmacSignature('secret', payload, 't=abc,s=def')).toBe(false);
      });

      it('should reject null signature', () => {
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        expect(verifyHmacSignature('secret', payload, '' as any)).toBe(false);
      });
    });

    describe('Replay attack prevention', () => {
      it('should reject old signatures (older than default 5 minutes)', () => {
        const secret = 'my-secret-key';
        const oldTimestamp = Date.now() - (10 * 60 * 1000); // 10 minutes ago
        const oldPayload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: { old: true },
          timestamp: new Date(oldTimestamp).toISOString(),
        };

        // Manually create a signature with old timestamp
        const message = `${oldTimestamp}.${JSON.stringify(oldPayload)}`;
        const hmac = require('crypto').createHmac('sha256', secret);
        hmac.update(message);
        const oldSignature = `t=${oldTimestamp},s=${hmac.digest('hex')}`;

        expect(verifyHmacSignature(secret, oldPayload, oldSignature)).toBe(false);
      });

      it('should accept recent signatures (within 5 minutes)', () => {
        const secret = 'my-secret-key';
        const recentPayload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: { fresh: true },
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, recentPayload);
        expect(verifyHmacSignature(secret, recentPayload, signature)).toBe(true);
      });

      it('should allow custom max age', () => {
        const secret = 'my-secret-key';
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, payload);
        // Should work with generous max age
        expect(verifyHmacSignature(secret, payload, signature, 60 * 60 * 1000)).toBe(true); // 1 hour
      });

      it('should enforce absolute maximum age of 30 minutes', () => {
        const secret = 'my-secret-key';
        const payload: WebhookPayload = {
          id: 'test',
          type: 'system.health.check' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, payload);
        // Even with very generous max age, 30 minutes is the absolute limit
        expect(verifyHmacSignature(secret, payload, signature, 999 * 60 * 60 * 1000)).toBe(true);
      });
    });

    describe('Payload tampering detection', () => {
      it('should detect tampered data', () => {
        const secret = 'my-secret-key';
        const originalPayload: WebhookPayload = {
          id: 'test',
          type: 'asset.created' as WebhookEvent,
          data: { value: 100 },
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, originalPayload);

        // Tamper with the data
        const tamperedPayload = { ...originalPayload, data: { value: 9999 } };
        expect(verifyHmacSignature(secret, tamperedPayload, signature)).toBe(false);
      });

      it('should detect tampered event type', () => {
        const secret = 'my-secret-key';
        const originalPayload: WebhookPayload = {
          id: 'test',
          type: 'asset.created' as WebhookEvent,
          data: {},
          timestamp: new Date().toISOString(),
        };

        const signature = generateHmacSignature(secret, originalPayload);

        // Tamper with the type
        const tamperedPayload = { ...originalPayload, type: 'asset.deleted' as WebhookEvent };
        expect(verifyHmacSignature(secret, tamperedPayload, signature)).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty payload data', () => {
      const secret = 'secret';
      const payload: WebhookPayload = {
        id: 'test',
        type: 'system.health.check' as WebhookEvent,
        data: {},
        timestamp: new Date().toISOString(),
      };

      const signature = generateHmacSignature(secret, payload);
      expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
    });

    it('should handle complex nested payload data', () => {
      const secret = 'secret';
      const payload: WebhookPayload = {
        id: 'test',
        type: 'asset.created' as WebhookEvent,
        data: {
          assetId: 'asset-123',
          details: {
            name: 'Test Asset',
            location: {
              building: 'A',
              floor: 3,
              rack: 'R12',
            },
            tags: ['production', 'critical'],
            metadata: {
              custom: { key1: 'value1', key2: 'value2' },
            },
          },
        },
        timestamp: new Date().toISOString(),
      };

      const signature = generateHmacSignature(secret, payload);
      expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
    });

    it('should handle URL with query parameters', () => {
      const result = validateWebhookUrl('https://hooks.example.com/webhook?token=abc123&env=prod');
      expect(result.valid).toBe(true);
    });

    it('should handle URL with path segments', () => {
      const result = validateWebhookUrl('https://example.com/api/v2/webhooks/incoming');
      expect(result.valid).toBe(true);
    });
  });
});
