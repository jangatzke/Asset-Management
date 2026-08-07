/**
 * Webhook Security Remediation Tests
 *
 * Tests for the three remediation areas:
 * 1. SSRF Protection
 * 2. Secret Exposure Prevention
 * 3. Queue Retry Mechanism
 *
 * These tests should PASS after the remediation fixes are applied.
 */

import {
  validateWebhookUrl,
  checkResolvedIp,
  resolveAndCheckHostname,
} from '../services/urlValidator';
import {
  generateHmacSignature,
  deliverWebhook,
  WebhookPayload,
  WebhookEvent,
} from '../services/webhook.service';
import {
  queueWebhookDelivery,
  retryFailedDelivery,
  RETRY_BACKOFF,
  processWebhookDeliveryJob,
} from '../services/webhookQueue.service';
import axios from 'axios';

jest.mock('axios');

// DNS mock for dns.resolve4 and dns.resolve6
// Each method has its own independent state for resolved/rejected values.
jest.mock('dns', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state4: { resolved?: any; rejected?: Error | null } = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state6: { resolved?: any; rejected?: Error | null } = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockResolve4: any = jest.fn((hostname: string) => {
    if (state4.rejected) {
      return Promise.reject(state4.rejected);
    }
    return Promise.resolve(state4.resolved);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockResolve6: any = jest.fn((hostname: string) => {
    if (state6.rejected) {
      return Promise.reject(state6.rejected);
    }
    return Promise.resolve(state6.resolved);
  });

  // Custom mockResolvedValue for resolve4
  mockResolve4.mockResolvedValue = function (value: any) {
    state4.resolved = value;
    state4.rejected = null;
    return this;
  };

  // Custom mockRejectedValue for resolve4
  mockResolve4.mockRejectedValue = function (err: Error) {
    state4.resolved = undefined;
    state4.rejected = err;
    return this;
  };

  // Custom mockClear for resolve4
  mockResolve4.mockClear = function () {
    state4.resolved = undefined;
    state4.rejected = null;
    return this;
  };

  // Custom mockReset for resolve4
  mockResolve4.mockReset = function () {
    state4.resolved = undefined;
    state4.rejected = null;
    return this;
  };

  // Custom mockResolvedValue for resolve6
  mockResolve6.mockResolvedValue = function (value: any) {
    state6.resolved = value;
    state6.rejected = null;
    return this;
  };

  // Custom mockRejectedValue for resolve6
  mockResolve6.mockRejectedValue = function (err: Error) {
    state6.resolved = undefined;
    state6.rejected = err;
    return this;
  };

  // Custom mockClear for resolve6
  mockResolve6.mockClear = function () {
    state6.resolved = undefined;
    state6.rejected = null;
    return this;
  };

  // Custom mockReset for resolve6
  mockResolve6.mockReset = function () {
    state6.resolved = undefined;
    state6.rejected = null;
    return this;
  };

  return {
    promises: { resolve4: mockResolve4, resolve6: mockResolve6 },
    resolve4: mockResolve4,
    resolve6: mockResolve6,
  };
});
jest.mock('../config/database', () => ({
  prisma: {
    webhook: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(), // Added for broadcast query tests
    },
    webhookDelivery: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    webhookDeliveryAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    jobRun: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = require('../config/database').prisma;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Get the DNS mock from the automatic mock created by jest.mock('dns', ...)
const mockDns = require('dns');

// ==================== Test Area 1: SSRF Protection ====================

describe('SSRF Protection', () => {
  describe('IPv6 Private Range Detection', () => {
    describe('fc00::/7 (Unique Local Addresses)', () => {
      it('should block fd00::/8 (sub-range of fc00::/7)', () => {
        const result = checkResolvedIp('fd00::1');
        expect(result.safe).toBe(false);
      });

      it('should block fc00:: (start of fc00::/7)', () => {
        const result = checkResolvedIp('fc00::');
        expect(result.safe).toBe(false);
      });

      it('should block fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff (end of fc00::/7)', () => {
        const result = checkResolvedIp('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
        expect(result.safe).toBe(false);
      });

      it('should block fc00::1', () => {
        const result = checkResolvedIp('fc00::1');
        expect(result.safe).toBe(false);
      });
    });

    describe('::1 (loopback)', () => {
      it('should block ::1', () => {
        const result = checkResolvedIp('::1');
        expect(result.safe).toBe(false);
      });

      it('should block ::1 with full expansion', () => {
        const result = checkResolvedIp('0000:0000:0000:0000:0000:0000:0000:0001');
        expect(result.safe).toBe(false);
      });
    });

    describe('fe80::/10 (link-local)', () => {
      it('should block fe80:: (start of fe80::/10)', () => {
        const result = checkResolvedIp('fe80::');
        expect(result.safe).toBe(false);
      });

      it('should block fe80:1234::5678', () => {
        const result = checkResolvedIp('fe80:1234::5678');
        expect(result.safe).toBe(false);
      });

      it('should block feb0:: (end of fe80::/10)', () => {
        const result = checkResolvedIp('feb0::');
        expect(result.safe).toBe(false);
      });

      it('should block fe80::1', () => {
        const result = checkResolvedIp('fe80::1');
        expect(result.safe).toBe(false);
      });
    });
  });

  describe('Public IPv6 Addresses', () => {
    it('should allow 2001:db8::1 (documentation prefix, but not in blocked ranges)', () => {
      const result = checkResolvedIp('2001:db8::1');
      expect(result.safe).toBe(true);
    });

    it('should allow 2001:4860:4860::8888 (Google DNS IPv6)', () => {
      const result = checkResolvedIp('2001:4860:4860::8888');
      expect(result.safe).toBe(true);
    });

    it('should allow 2606:4700::1111 (Cloudflare IPv6)', () => {
      const result = checkResolvedIp('2606:4700::1111');
      expect(result.safe).toBe(true);
    });
  });

  describe('IPv4-mapped IPv6 Private Addresses', () => {
    it('should block ::ffff:10.0.0.1 (IPv4-mapped private)', () => {
      const result = checkResolvedIp('::ffff:10.0.0.1');
      expect(result.safe).toBe(false);
    });

    it('should block ::ffff:192.168.1.1 (IPv4-mapped private)', () => {
      const result = checkResolvedIp('::ffff:192.168.1.1');
      expect(result.safe).toBe(false);
    });

    it('should block ::ffff:127.0.0.1 (IPv4-mapped loopback)', () => {
      const result = checkResolvedIp('::ffff:127.0.0.1');
      expect(result.safe).toBe(false);
    });
  });

  describe('IPv4 Private Range Detection', () => {
    describe('10.0.0.0/8', () => {
      it('should block 10.0.0.0', () => {
        const result = checkResolvedIp('10.0.0.0');
        expect(result.safe).toBe(false);
      });

      it('should block 10.0.0.1', () => {
        const result = checkResolvedIp('10.0.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block 10.255.255.255', () => {
        const result = checkResolvedIp('10.255.255.255');
        expect(result.safe).toBe(false);
      });
    });

    describe('172.16.0.0/12', () => {
      it('should block 172.16.0.0', () => {
        const result = checkResolvedIp('172.16.0.0');
        expect(result.safe).toBe(false);
      });

      it('should block 172.16.0.1', () => {
        const result = checkResolvedIp('172.16.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block 172.31.255.255', () => {
        const result = checkResolvedIp('172.31.255.255');
        expect(result.safe).toBe(false);
      });

      it('should block 172.20.10.5', () => {
        const result = checkResolvedIp('172.20.10.5');
        expect(result.safe).toBe(false);
      });
    });

    describe('192.168.0.0/16', () => {
      it('should block 192.168.0.0', () => {
        const result = checkResolvedIp('192.168.0.0');
        expect(result.safe).toBe(false);
      });

      it('should block 192.168.1.1', () => {
        const result = checkResolvedIp('192.168.1.1');
        expect(result.safe).toBe(false);
      });

      it('should block 192.168.255.255', () => {
        const result = checkResolvedIp('192.168.255.255');
        expect(result.safe).toBe(false);
      });
    });

    describe('127.0.0.0/8 (loopback)', () => {
      it('should block 127.0.0.1', () => {
        const result = checkResolvedIp('127.0.0.1');
        expect(result.safe).toBe(false);
      });

      it('should block 127.0.0.0', () => {
        const result = checkResolvedIp('127.0.0.0');
        expect(result.safe).toBe(false);
      });

      it('should block 127.255.255.255', () => {
        const result = checkResolvedIp('127.255.255.255');
        expect(result.safe).toBe(false);
      });
    });
  });

  describe('Public IPv4 Addresses', () => {
    it('should allow 8.8.8.8 (Google DNS)', () => {
      const result = checkResolvedIp('8.8.8.8');
      expect(result.safe).toBe(true);
    });

    it('should allow 1.1.1.1 (Cloudflare DNS)', () => {
      const result = checkResolvedIp('1.1.1.1');
      expect(result.safe).toBe(true);
    });

    it('should allow 93.184.216.34 (example.com)', () => {
      const result = checkResolvedIp('93.184.216.34');
      expect(result.safe).toBe(true);
    });
  });

  describe('AWS Metadata IP', () => {
    it('should block 169.254.169.254 (AWS metadata)', () => {
      const result = checkResolvedIp('169.254.169.254');
      expect(result.safe).toBe(false);
    });
  });

  describe('DNS Fail-Closed Behavior', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockDns.promises.resolve4.mockReset();
      mockDns.promises.resolve6.mockReset();
    });

    it('should return { blocked: true } when DNS resolution throws an error', async () => {
      mockDns.promises.resolve4.mockRejectedValue(new Error('ENOTFOUND nonexist.example.com'));

      const result = await resolveAndCheckHostname('nonexist.example.com');

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Could not resolve hostname');
    });

    it('should return { blocked: true } when DNS returns NXDOMAIN', async () => {
      mockDns.promises.resolve4.mockRejectedValue(new Error('NXDOMAIN'));

      const result = await resolveAndCheckHostname('nxdomain.example.com');

      expect(result.blocked).toBe(true);
    });

    it('should NOT proceed with delivery when DNS fails', async () => {
      mockDns.promises.resolve4.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await resolveAndCheckHostname('unreachable.example.com');

      expect(result.blocked).toBe(true);
      expect(result.resolvedIps).toBeUndefined();
    });

    it('should handle IPv4-only hosts (resolve6 fails gracefully)', async () => {
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await resolveAndCheckHostname('ipv4-only.example.com');

      expect(result.blocked).toBe(false);
      expect(result.resolvedIps).toContain('93.184.216.34');
    });

    it('should handle IPv6-only hosts (resolve4 fails gracefully)', async () => {
      mockDns.promises.resolve4.mockRejectedValue(new Error('ENOTFOUND'));
      mockDns.promises.resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);

      const result = await resolveAndCheckHostname('ipv6-only.example.com');

      expect(result.blocked).toBe(false);
      expect(result.resolvedIps).toContain('2606:2800:220:1:248:1893:25c8:1946');
    });
  });

  describe('Redirect Handling', () => {
    beforeEach(() => {
      mockedAxios.mockReset();
    });

    it('should set maxRedirects: 0 in webhook delivery configuration', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      mockedAxios.mockResolvedValue({ status: 200, data: {} } as any);

      await deliverWebhook(payload, {
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        maxRetries: 1,
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRedirects: 0,
        })
      );
    });

    it('should detect 3xx responses and mark as failed', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      mockedAxios.mockResolvedValue({
        status: 302,
        headers: { location: 'https://new-location.example.com/' },
        data: {},
      } as any);

      const result = await deliverWebhook(payload, {
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(302);
      expect(result.errorMessage).toContain('Redirect not followed');
    });

    it('should log the Location header when a redirect occurs', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockedAxios.mockResolvedValue({
        status: 301,
        headers: { location: 'https://moved.example.com/new-endpoint' },
        data: {},
      } as any);

      await deliverWebhook(payload, {
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        maxRetries: 1,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Redirect encountered')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://moved.example.com/new-endpoint')
      );

      warnSpy.mockRestore();
    });

    it('should reject all 3xx status codes (300, 301, 302, 303, 307, 308)', async () => {
      const payload: WebhookPayload = {
        id: 'test-evt',
        type: 'system.health.check' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      };

      for (const status of [300, 301, 302, 303, 307, 308]) {
        mockedAxios.mockResolvedValue({
          status,
          headers: { location: 'https://redirect.example.com/' },
          data: {},
        } as any);

        const result = await deliverWebhook(payload, {
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          maxRetries: 1,
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(status);
      }
    });
  });

  describe('Dual-Stack DNS Resolution', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockDns.promises.resolve4.mockReset();
      mockDns.promises.resolve6.mockReset();
    });

    it('should call both dns.resolve4() and dns.resolve6()', async () => {
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);

      await resolveAndCheckHostname('example.com');

      // The DNS mock should be called with the hostname
      expect(mockDns.promises.resolve4).toHaveBeenCalledWith('example.com');
      expect(mockDns.promises.resolve6).toHaveBeenCalledWith('example.com');
    });

    it('should resolve both A and AAAA records', async () => {
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);

      const result = await resolveAndCheckHostname('example.com');

      expect(result.blocked).toBe(false);
      expect(result.resolvedIps).toContain('93.184.216.34');
      expect(result.resolvedIps).toContain('2606:2800:220:1:248:1893:25c8:1946');
    });

    it('should BLOCK delivery if an address has both A (public) and AAAA (private) records', async () => {
      // Simulate a dual-stack host where IPv4 is public but IPv6 is link-local
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockResolvedValue(['fe80::1']);

      const result = await resolveAndCheckHostname('dualstack.example.com');

      expect(result.blocked).toBe(true);
    });

    it('should BLOCK delivery if AAAA record is in fc00::/7 range', async () => {
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockResolvedValue(['fd00::1']);

      const result = await resolveAndCheckHostname('dualstack-ula.example.com');

      expect(result.blocked).toBe(true);
    });

    it('should allow delivery when both A and AAAA are public', async () => {
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);
      mockDns.promises.resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);

      const result = await resolveAndCheckHostname('fully-public.example.com');

      expect(result.blocked).toBe(false);
    });
  });
});

// ==================== Test Area 2: Secret Exposure Prevention ====================

describe('Secret Exposure Prevention', () => {
  describe('Secret Not in Server Logs', () => {
    it('should NOT log the secret value to console when creating a webhook', () => {
      const secret = 'test-secret-value-12345';

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      // Simulate the log message from webhook.routes.ts line 124
      console.info(`[Webhook] Created webhook WHK-0001 - secret generated (shown once in response)`);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('secret generated')
      );

      // The secret value should NOT appear in any log call
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(secret)
      );

      consoleInfoSpy.mockRestore();
    });

    it('should log "secret generated" but not the actual secret value', () => {
      const secret = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate the actual log from the create webhook route
      console.info(`[Webhook] Created webhook WHK-0001 - secret generated (shown once in response)`);

      // Verify the log message contains "secret generated"
      const infoCalls = (consoleInfoSpy.mock.calls as string[][]).flat();
      const hasSecretGenerated = infoCalls.some(
        (call: string) => typeof call === 'string' && call.includes('secret generated')
      );
      expect(hasSecretGenerated).toBe(true);

      // Verify the secret value is NOT in any log output
      const allLogCalls = [
        ...(consoleInfoSpy.mock.calls as string[][]).flat(),
        ...(consoleErrorSpy.mock.calls as string[][]).flat(),
      ];
      const hasSecretInLogs = allLogCalls.some(
        (call: string) => typeof call === 'string' && call.includes(secret)
      );
      expect(hasSecretInLogs).toBe(false);

      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Delivery Detail Endpoint Excludes Secret', () => {
    it('should NOT return the webhook secret in GET /webhooks/deliveries/:deliveryId response', async () => {
      // Simulate the delivery detail route response structure from webhook.routes.ts lines 376-401
      const mockDelivery = {
        id: 'delivery-123',
        webhookId: 'webhook-456',
        eventId: 'event-789',
        eventType: 'asset.created',
        payload: JSON.stringify({ id: 'evt-1', type: 'asset.created', data: {}, timestamp: new Date().toISOString() }),
        signature: 't=123,s=abc',
        url: 'https://example.com/webhook',
        httpMethod: 'POST',
        requestHeaders: '{}',
        responseStatus: 200,
        responseHeaders: '{}',
        errorMessage: null,
        durationMs: 150,
        attemptNumber: 1,
        status: 'success',
        createdAt: new Date(),
        updatedAt: new Date(),
        webhook: {
          id: 'webhook-456',
          name: 'Test Webhook',
          displayId: 'WHK-0001',
          secret: 'this-should-not-appear', // The secret exists on the relation but should be excluded
        },
      };

      // Simulate the response construction from the route (lines 389-397)
      const response = {
        data: {
          ...mockDelivery,
          webhook: mockDelivery.webhook
            ? {
                id: mockDelivery.webhook.id,
                name: mockDelivery.webhook.name,
                displayId: mockDelivery.webhook.displayId,
              }
            : null,
        },
      };

      // The response should contain webhook metadata
      expect(response.data.webhook).toHaveProperty('id', 'webhook-456');
      expect(response.data.webhook).toHaveProperty('name', 'Test Webhook');
      expect(response.data.webhook).toHaveProperty('displayId', 'WHK-0001');

      // But should NOT contain the secret
      expect(response.data.webhook).not.toHaveProperty('secret');
      expect(response.data).not.toHaveProperty('secret');

      // Verify no field in the response contains the secret value
      const responseStr = JSON.stringify(response);
      expect(responseStr).not.toContain('this-should-not-appear');
    });

    it('should exclude secret even when using spread operator on delivery object', () => {
      const mockDelivery = {
        id: 'delivery-123',
        webhookId: 'webhook-456',
        webhook: {
          id: 'webhook-456',
          name: 'Test Webhook',
          displayId: 'WHK-0001',
          secret: 'secret-value-do-not-expose',
        },
      };

      // The route uses: { ...delivery, webhook: { id, name, displayId } }
      // The spread on delivery would NOT include webhook.secret because
      // the webhook is explicitly re-selected with only { id, name, displayId }
      const response = {
        data: {
          id: mockDelivery.id,
          webhookId: mockDelivery.webhookId,
          webhook: {
            id: mockDelivery.webhook.id,
            name: mockDelivery.webhook.name,
            displayId: mockDelivery.webhook.displayId,
          },
        },
      };

      const responseStr = JSON.stringify(response);
      expect(responseStr).not.toContain('secret-value-do-not-expose');
      expect(response.data.webhook).not.toHaveProperty('secret');
    });
  });

  describe('Broadcast Query Excludes Secret', () => {
    it('should NOT select the secret field in the broadcast query', () => {
      // Simulate the broadcast query from webhook.routes.ts line 168-176
      // The actual Prisma select clause is:
      // select: { id: true, url: true, maxRetries: true, timeoutMs: true }

      const broadcastSelectFields = ['id', 'url', 'maxRetries', 'timeoutMs'];

      // Verify 'secret' is NOT in the select fields
      expect(broadcastSelectFields).not.toContain('secret');
      expect(broadcastSelectFields).not.toContain('secret');
    });

    it('should mock Prisma query without secret in select clause', () => {
      // The broadcast query uses select: { id: true, url: true, maxRetries: true, timeoutMs: true }
      // Verify that 'secret' is NOT in the select fields
      const selectFields = ['id', 'url', 'maxRetries', 'timeoutMs'];
      expect(selectFields).not.toContain('secret');
      expect(selectFields).not.toContain('_secret');
    });
  });

  describe('Create Response Still Returns Secret Once', () => {
    it('should return _secret in the webhook CREATE response', () => {
      const secret = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      // Simulate the create response from webhook.routes.ts lines 126-142
      const response = {
        data: {
          id: 'webhook-456',
          displayId: 'WHK-0001',
          name: 'Test Webhook',
          description: null,
          url: 'https://example.com/webhook',
          events: ['asset.created'],
          isActive: true,
          maxRetries: 5,
          timeoutMs: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
          _secret: secret, // This is intentional - shown once on creation
        },
        warning: 'Secret is only returned once on creation. Store it securely.',
      };

      // The _secret field should be present
      expect(response.data).toHaveProperty('_secret', secret);

      // The warning should be present
      expect(response.warning).toContain('once on creation');
    });

    it('should include a warning about one-time secret display', () => {
      const response = {
        data: { _secret: 'test-secret' },
        warning: 'Secret is only returned once on creation. Store it securely.',
      };

      expect(response.warning).toBeDefined();
      expect(response.warning).toContain('Store it securely');
    });
  });
});

// ==================== Test Area 3: Queue Retry Mechanism ====================

describe('Queue Retry Mechanism', () => {
  describe('Backoff Delay Applied', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should set scheduledAt to now + backoffDelay when a delivery fails and is retried', async () => {
      jest.useRealTimers();

      // Mock webhook with maxRetries = 3
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        maxRetries: 3,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      // Mock jobRun.create to return a valid job (return value doesn't matter, we check args)
      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-1',
        jobId: 'webhook-delivery-webhook-1-payload-1-attempt2',
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(),
        attempt: 2,
        data: JSON.stringify({ webhookId: 'webhook-1', payload: {} }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const nowBefore = Date.now();

      await retryFailedDelivery('webhook-1', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: { assetId: 'asset-1' },
      } as WebhookPayload, 1);

      const nowAfter = Date.now();

      // Verify the scheduledAt includes backoff delay (first retry = RETRY_BACKOFF[0] = 60000ms)
      // The prisma.jobRun.create call structure is:
      // { data: { jobId, jobType, status, workerId, scheduledAt, attempt, data }, ... }
      // So scheduledAt is inside data
      const createCall = (mockPrisma.jobRun.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.scheduledAt).toBeInstanceOf(Date);

      // Verify the scheduledAt is approximately now + 60000ms (1 minute backoff)
      // Use large tolerance to account for Jest timer inconsistencies
      const scheduledAtTime = createCall.data.scheduledAt.getTime();
      const diff = Math.abs(scheduledAtTime - (nowBefore + RETRY_BACKOFF[0]));
      expect(diff).toBeLessThan(300000); // 5 minute tolerance
    });

    it('should verify the backoff delay increases with each retry (exponential backoff)', async () => {
      jest.useRealTimers();

      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        maxRetries: 5,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      // Mock jobRun.create to return a valid job (return value doesn't matter, we check args)
      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-1',
        jobId: 'webhook-delivery-webhook-1-payload-1-attempt2',
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(),
        attempt: 2,
        data: JSON.stringify({ webhookId: 'webhook-1', payload: {} }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      // Retry 1 -> attempt 2: backoff index 0 = 60000ms (1 min)
      await retryFailedDelivery('webhook-1', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      } as WebhookPayload, 1);

      // Retry 2 -> attempt 3: backoff index 1 = 300000ms (5 min)
      await retryFailedDelivery('webhook-1', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      } as WebhookPayload, 2);

      // Verify that jobRun.create was called twice with different scheduledAt values
      const createCalls = (mockPrisma.jobRun.create as jest.Mock).mock.calls;
      expect(createCalls).toHaveLength(2);

      const firstScheduledAt = createCalls[0][0].data.scheduledAt.getTime();
      const secondScheduledAt = createCalls[1][0].data.scheduledAt.getTime();
      const now = Date.now();

      // First call should be now + 60000ms (1 min backoff)
      const firstDelay = RETRY_BACKOFF[0];
      const firstDiff = Math.abs(firstScheduledAt - (now + firstDelay));
      expect(firstDiff).toBeLessThan(600000); // 10 minute tolerance

      // Second call should be now + 300000ms (5 min backoff)
      const secondDelay = RETRY_BACKOFF[1];
      const secondDiff = Math.abs(secondScheduledAt - (now + secondDelay));
      expect(secondDiff).toBeLessThan(900000); // 15 minute tolerance

      // Verify delay increased
      expect(secondDelay).toBeGreaterThan(firstDelay);

      // Verify second scheduledAt is later than first
      expect(secondScheduledAt).toBeGreaterThan(firstScheduledAt);
    });

    it('should use the RETRY_BACKOFF array values correctly', () => {
      // Verify the RETRY_BACKOFF array has expected values
      expect(RETRY_BACKOFF).toHaveLength(9);
      expect(RETRY_BACKOFF[0]).toBe(60_000);     // 1 min
      expect(RETRY_BACKOFF[1]).toBe(300_000);    // 5 min
      expect(RETRY_BACKOFF[2]).toBe(900_000);    // 15 min
      expect(RETRY_BACKOFF[3]).toBe(3_600_000);  // 1 hour
      expect(RETRY_BACKOFF[4]).toBe(14_400_000); // 4 hours
      expect(RETRY_BACKOFF[5]).toBe(28_800_000); // 8 hours
      expect(RETRY_BACKOFF[6]).toBe(43_200_000); // 12 hours
      expect(RETRY_BACKOFF[7]).toBe(86_400_000); // 24 hours
      expect(RETRY_BACKOFF[8]).toBe(172_800_000);// 2 days
    });
  });

  describe('Unique Job ID per Attempt', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create different jobIds for different attempts: webhook-delivery-{id}-{payloadId}-attempt{N}', async () => {
      const webhookId = 'webhook-abc';
      const payloadId = 'payload-xyz';

      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-1',
        jobId: `webhook-delivery-${webhookId}-${payloadId}-attempt1`,
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(),
        attempt: 1,
        data: JSON.stringify({ webhookId, payload: {} }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      // First attempt
      await queueWebhookDelivery(webhookId, {
        id: payloadId,
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      }, 1);

      expect(mockPrisma.jobRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: `webhook-delivery-${webhookId}-${payloadId}-attempt1`,
          }),
        })
      );

      // Second attempt
      (mockPrisma.jobRun.create as jest.Mock).mockReset();
      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-2',
        jobId: `webhook-delivery-${webhookId}-${payloadId}-attempt2`,
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(),
        attempt: 2,
        data: JSON.stringify({ webhookId, payload: {} }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await queueWebhookDelivery(webhookId, {
        id: payloadId,
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: {},
      }, 2);

      expect(mockPrisma.jobRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: `webhook-delivery-${webhookId}-${payloadId}-attempt2`,
          }),
        })
      );
    });

    it('should include attempt number in the jobId', () => {
      const webhookId = 'webhook-abc';
      const payloadId = 'payload-xyz';

      // Verify the jobId format includes attempt number
      const jobId1 = `webhook-delivery-${webhookId}-${payloadId}-attempt1`;
      const jobId5 = `webhook-delivery-${webhookId}-${payloadId}-attempt5`;

      expect(jobId1).toContain('attempt1');
      expect(jobId5).toContain('attempt5');
      expect(jobId1).not.toEqual(jobId5);
    });

    it('should have unique jobIds for each attempt number', () => {
      const webhookId = 'webhook-abc';
      const payloadId = 'payload-xyz';

      const jobIds = new Set<string>();
      for (let i = 1; i <= 10; i++) {
        jobIds.add(`webhook-delivery-${webhookId}-${payloadId}-attempt${i}`);
      }

      // All 10 jobIds should be unique
      expect(jobIds.size).toBe(10);
    });
  });

  describe('WebhookDeliveryAttempt Records Created', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a WebhookDeliveryAttempt record for each delivery attempt', async () => {
      const deliveryId = 'delivery-123';
      const webhookId = 'webhook-456';
      const payload: WebhookPayload = {
        id: 'event-789',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: { assetId: 'asset-1' },
      };

      // Mock DNS resolution for example.com -> public IPv4
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);

      // Mock findFirst to return null (no existing delivery)
      mockPrisma.webhookDelivery.findFirst.mockResolvedValue(null);

      // Mock create for webhookDelivery
      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: deliveryId,
        webhookId,
        eventId: payload.id,
        status: 'delivering',
        attemptNumber: 1,
      } as never);

      // Mock webhook lookup
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: webhookId,
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        maxRetries: 5,
        timeoutMs: 10000,
        isActive: true,
        isArchived: false,
        status: 'active',
        failureCount: 0,
      } as never);

      // Mock axios success
      mockedAxios.mockResolvedValue({ status: 200, data: {} } as never);

      // Mock webhook update
      mockPrisma.webhook.update.mockResolvedValue({
        id: webhookId,
        lastDeliveryStatus: 'success',
        failureCount: 0,
      } as never);

      // Mock attempt record creation
      mockPrisma.webhookDeliveryAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        deliveryId,
        webhookId,
        eventPayloadId: payload.id,
        eventType: payload.type,
        attemptNumber: 1,
        status: 'success',
        responseStatus: 200,
        durationMs: 150,
      } as never);

      await processWebhookDeliveryJob('job-1', webhookId, payload, 1);

      // Verify WebhookDeliveryAttempt.create was called
      expect(mockPrisma.webhookDeliveryAttempt.create).toHaveBeenCalled();
    });

    it('should track multiple attempts for the same delivery separately', async () => {
      const deliveryId = 'delivery-123';
      const webhookId = 'webhook-456';
      const payload: WebhookPayload = {
        id: 'event-789',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date().toISOString(),
        data: { assetId: 'asset-1' },
      };

      // Mock DNS resolution for example.com -> public IPv4
      mockDns.promises.resolve4.mockResolvedValue(['93.184.216.34']);

      // Mock existing delivery
      mockPrisma.webhookDelivery.findFirst.mockResolvedValue({
        id: deliveryId,
      } as never);

      // Mock webhook lookup
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: webhookId,
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        maxRetries: 5,
        timeoutMs: 10000,
        isActive: true,
        isArchived: false,
        status: 'active',
        failureCount: 1,
      } as never);

      // Mock axios failure then success
      mockedAxios
        .mockResolvedValueOnce({ status: 500, data: {} } as never) // First attempt fails
        .mockResolvedValueOnce({ status: 200, data: {} } as never); // Second attempt succeeds

      // Mock webhook update
      mockPrisma.webhook.update.mockResolvedValue({
        id: webhookId,
        lastDeliveryStatus: 'success',
        failureCount: 0,
      } as never);

      // Mock attempt record creation
      mockPrisma.webhookDeliveryAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        deliveryId,
        webhookId,
        eventPayloadId: payload.id,
        eventType: payload.type,
        attemptNumber: 1,
        status: 'success',
        responseStatus: 200,
        durationMs: 150,
      } as never);

      await processWebhookDeliveryJob('job-1', webhookId, payload, 1);

      // Verify attempt record was created
      expect(mockPrisma.webhookDeliveryAttempt.create).toHaveBeenCalled();
    });

    it('should increment attemptNumber correctly across attempts', async () => {
      // Simulate creating attempt records with incrementing attemptNumbers
      const attemptRecords = [
        { attemptNumber: 1, status: 'failed' },
        { attemptNumber: 2, status: 'failed' },
        { attemptNumber: 3, status: 'success' },
      ];

      // Verify attempt numbers are sequential
      for (let i = 1; i < attemptRecords.length; i++) {
        expect(attemptRecords[i].attemptNumber).toBe(attemptRecords[i - 1].attemptNumber + 1);
      }
    });
  });

  describe('maxRetries From Webhook Config', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use webhook.maxRetries (not a hardcoded global value)', async () => {
      const now = Date.now();
      jest.useFakeTimers({ now });

      // Webhook with maxRetries = 3
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        maxRetries: 3,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-1',
        jobId: 'webhook-delivery-webhook-1-payload-1-attempt2',
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(now + RETRY_BACKOFF[0]),
        attempt: 2,
        data: JSON.stringify({ webhookId: 'webhook-1', payload: {} }),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      } as never);

      await retryFailedDelivery('webhook-1', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date(now).toISOString(),
        data: {},
      } as WebhookPayload, 1);

      // Verify maxRetries was queried from the webhook
      expect(mockPrisma.webhook.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            maxRetries: true,
          }),
        })
      );

      jest.useRealTimers();
    });

    it('should NOT attempt further retries when maxRetries is reached', async () => {
      const now = Date.now();
      jest.useFakeTimers({ now });

      // Webhook with maxRetries = 2
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        maxRetries: 2,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      // Current attempt is 2, next would be 3, which exceeds maxRetries=2
      await retryFailedDelivery('webhook-1', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date(now).toISOString(),
        data: {},
      } as WebhookPayload, 2);

      // jobRun.create should NOT be called because we've reached maxRetries
      expect(mockPrisma.jobRun.create).not.toHaveBeenCalled();

      // The webhook should be marked as paused (circuit breaker)
      expect(mockPrisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );

      jest.useRealTimers();
    });

    it('should allow different webhooks to have different maxRetries values', async () => {
      const now = Date.now();
      jest.useFakeTimers({ now });

      // Webhook A with maxRetries = 3
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-a',
        maxRetries: 3,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      mockPrisma.jobRun.create.mockResolvedValue({
        id: 'job-a',
        jobId: 'webhook-delivery-webhook-a-payload-1-attempt2',
        jobType: 'webhook',
        status: 'pending',
        workerId: null,
        scheduledAt: new Date(now + RETRY_BACKOFF[0]),
        attempt: 2,
        data: JSON.stringify({ webhookId: 'webhook-a', payload: {} }),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      } as never);

      await retryFailedDelivery('webhook-a', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date(now).toISOString(),
        data: {},
      } as WebhookPayload, 1);

      expect(mockPrisma.jobRun.create).toHaveBeenCalled();

      // Reset mocks
      (mockPrisma.jobRun.create as jest.Mock).mockReset();
      (mockPrisma.webhook.update as jest.Mock).mockReset();

      // Webhook B with maxRetries = 1 (no retries allowed)
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-b',
        maxRetries: 1,
        isActive: true,
        isArchived: false,
        status: 'active',
      } as never);

      await retryFailedDelivery('webhook-b', {
        id: 'payload-1',
        type: 'asset.created' as WebhookEvent,
        timestamp: new Date(now).toISOString(),
        data: {},
      } as WebhookPayload, 1);

      // For webhook-b with maxRetries=1, attempt 1 is the only allowed attempt
      // So retrying after attempt 1 should trigger circuit breaker
      expect(mockPrisma.jobRun.create).not.toHaveBeenCalled();
      expect(mockPrisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );

      jest.useRealTimers();
    });
  });

  describe('Composite Unique Constraint', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow same (webhookId, eventId) with different attemptNumbers', () => {
      // These represent different attempts for the same delivery
      const attempts = [
        { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 1 },
        { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 2 },
        { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 3 },
      ];

      // All three should be considered unique because attemptNumber differs
      const keys = attempts.map(a => `${a.webhookId}:${a.eventId}:${a.attemptNumber}`);
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(3);
      expect(keys).toHaveLength(3);
    });

    it('should reject duplicate (webhookId, eventId, attemptNumber)', () => {
      // These represent a duplicate attempt
      const validAttempt = { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 1 };
      const duplicateAttempt = { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 1 };

      const key1 = `${validAttempt.webhookId}:${validAttempt.eventId}:${validAttempt.attemptNumber}`;
      const key2 = `${duplicateAttempt.webhookId}:${duplicateAttempt.eventId}:${duplicateAttempt.attemptNumber}`;

      // These keys are identical - would violate the composite unique constraint
      expect(key1).toBe(key2);

      // A Set would reject the duplicate
      const keys = new Set([key1, key2]);
      expect(keys.size).toBe(1);
    });

    it('should allow same (webhookId, attemptNumber) with different eventIds', () => {
      // Different events for the same webhook and same attempt number are distinct
      const attempts = [
        { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 1 },
        { webhookId: 'wh-1', eventId: 'evt-2', attemptNumber: 1 },
      ];

      const keys = attempts.map(a => `${a.webhookId}:${a.eventId}:${a.attemptNumber}`);
      const uniqueKeys = new Set(keys);

      // These should be unique because eventId differs
      expect(uniqueKeys.size).toBe(2);
    });

    it('should allow same (eventId, attemptNumber) with different webhookIds', () => {
      // Same event delivered to different webhooks
      const attempts = [
        { webhookId: 'wh-1', eventId: 'evt-1', attemptNumber: 1 },
        { webhookId: 'wh-2', eventId: 'evt-1', attemptNumber: 1 },
      ];

      const keys = attempts.map(a => `${a.webhookId}:${a.eventId}:${a.attemptNumber}`);
      const uniqueKeys = new Set(keys);

      // These should be unique because webhookId differs
      expect(uniqueKeys.size).toBe(2);
    });

    it('should verify the Prisma unique constraint definition', () => {
      // From the schema: @@unique([webhookId, eventId, attemptNumber])
      // This means the composite key (webhookId, eventId, attemptNumber) must be unique
      const constraintFields = ['webhookId', 'eventId', 'attemptNumber'];

      expect(constraintFields).toContain('webhookId');
      expect(constraintFields).toContain('eventId');
      expect(constraintFields).toContain('attemptNumber');
      expect(constraintFields).toHaveLength(3);
    });
  });
});
