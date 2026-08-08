import {
  idempotencyStore, 
  validateIdempotencyKey, 
  storeIdempotencyResponse,
  getIdempotencyResponse,
  getIdempotencyEntry,
  generateIdempotencyKey,
  generateRequestBodyHash,
  shouldCacheResponse,
  requestBodyMatches,
  startIdempotencyCleanup,
  stopIdempotencyCleanup 
} from '../services/idempotency.service';
import { RedisIdempotencyClient } from '../services/idempotency-redis-client';

describe('Idempotency Service', () => {
  beforeEach(() => {
    idempotencyStore.clear();
    stopIdempotencyCleanup();
  });

  describe('storeIdempotencyResponse', () => {
    test('should store a response for an idempotency key', () => {
      const options = {
        key: 'test-key-123',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'abc123',
      };
      
      storeIdempotencyResponse(options, { data: { id: 'asset-1' } });

      const entry = idempotencyStore.get('test-key-123');
      expect(entry).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (entry as any).data as Record<string, unknown>;
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('createdAt');
    });
  });

  describe('getIdempotencyResponse', () => {
    test('should return only entry.data.response for valid key', () => {
      const responseData = { status: 201, headers: { 'content-type': 'application/json' }, body: { id: 'new-asset' } };
      
      storeIdempotencyResponse({
        key: 'unique-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, responseData);

      // getIdempotencyResponse now returns ONLY entry.data.response
      const result = getIdempotencyResponse<typeof responseData>('unique-key');
      
      expect(result).toBeDefined();
      expect(result).toEqual(responseData);
      // Should NOT contain keyOptions or createdAt at the top level
      expect(result).not.toHaveProperty('keyOptions');
      expect(result).not.toHaveProperty('createdAt');
    });

    test('should return undefined for non-existent key', () => {
      const result = getIdempotencyResponse('non-existent-key');
      expect(result).toBeUndefined();
    });

    test('should return undefined for expired key', (done) => {
      storeIdempotencyResponse({
        key: 'expiring-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
        ttlMs: 50, // 50ms TTL for testing
      }, { status: 201, headers: {}, body: { data: 'test' } });

      setTimeout(() => {
        const result = getIdempotencyResponse('expiring-key');
        expect(result).toBeUndefined();
        done();
      }, 100);
    });
  });

  describe('getIdempotencyEntry (internal)', () => {
    test('should return full entry.data including keyOptions and createdAt', () => {
      storeIdempotencyResponse({
        key: 'entry-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { status: 201, headers: {}, body: { data: 'test' } });

      const result = getIdempotencyEntry<{ response: unknown; keyOptions: unknown; createdAt: number }>('entry-key');
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.response).toEqual({ status: 201, headers: {}, body: { data: 'test' } });
        expect(result.keyOptions).toHaveProperty('httpMethod', 'POST');
        expect(result.keyOptions).toHaveProperty('requestBodyHash', 'hash1');
        expect(typeof result.createdAt).toBe('number');
      }
    });
  });

  describe('validateIdempotencyKey', () => {
    test('should return true for valid stored key', () => {
      storeIdempotencyResponse({
        key: 'valid-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { status: 201, headers: {}, body: { data: 'test' } });

      expect(validateIdempotencyKey('valid-key')).toBe(true);
    });

    test('should return false for non-existent key', () => {
      expect(validateIdempotencyKey('non-existent')).toBe(false);
    });
  });

  describe('generateIdempotencyKey', () => {
    test('should generate a consistent key from principal + method + route + idempotency-key', () => {
      const key1 = generateIdempotencyKey('user-123', 'POST', '/api/v1/assets', 'req-abc');
      const key2 = generateIdempotencyKey('user-123', 'POST', '/api/v1/assets', 'req-abc');
      const key3 = generateIdempotencyKey('user-456', 'POST', '/api/v1/assets', 'req-abc');
      const key4 = generateIdempotencyKey('user-123', 'PUT', '/api/v1/assets', 'req-abc');
      const key5 = generateIdempotencyKey('user-123', 'POST', '/api/v1/assets', 'req-def');

      // Same inputs should produce same key
      expect(key1).toBe(key2);

      // Different principal should produce different key
      expect(key1).not.toBe(key3);

      // Different method should produce different key
      expect(key1).not.toBe(key4);

      // Different route should produce different key
      const key6 = generateIdempotencyKey('user-123', 'POST', '/api/v1/users', 'req-abc');
      expect(key1).not.toBe(key6);

      // Different idempotency key should produce different key
      expect(key1).not.toBe(key5);
    });

    test('should handle anonymous (undefined) principal', () => {
      const keyWithPrincipal = generateIdempotencyKey('user-123', 'POST', '/api/v1/assets', 'req-abc');
      const keyAnonymous = generateIdempotencyKey(undefined, 'POST', '/api/v1/assets', 'req-abc');
      
      expect(keyWithPrincipal).not.toBe(keyAnonymous);
      expect(keyAnonymous).toBeUndefined(); // SECURITY: Never falls back to 'anonymous'
    });

    test('should return hex string of correct length', () => {
      const key = generateIdempotencyKey('user', 'POST', '/api', 'key');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateRequestBodyHash', () => {
    test('should generate consistent hash for same object', () => {
      const obj = { name: 'test', value: 123 };
      const hash1 = generateRequestBodyHash(obj);
      const hash2 = generateRequestBodyHash(obj);
      expect(hash1).toBe(hash2);
    });

    test('should generate different hash for different objects', () => {
      const hash1 = generateRequestBodyHash({ name: 'test1' });
      const hash2 = generateRequestBodyHash({ name: 'test2' });
      expect(hash1).not.toBe(hash2);
    });

    test('should handle string input', () => {
      const hash = generateRequestBodyHash('raw-string');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should sort object keys for consistency', () => {
      const hash1 = generateRequestBodyHash({ a: 1, b: 2 });
      const hash2 = generateRequestBodyHash({ b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });
  });

  describe('shouldCacheResponse', () => {
    test('should cache 2xx responses', () => {
      expect(shouldCacheResponse(200)).toBe(true);
      expect(shouldCacheResponse(201)).toBe(true);
      expect(shouldCacheResponse(204)).toBe(true);
    });

    test('should cache 3xx responses', () => {
      expect(shouldCacheResponse(301)).toBe(true);
      expect(shouldCacheResponse(302)).toBe(true);
      expect(shouldCacheResponse(304)).toBe(true);
    });

    test('should NOT cache 4xx responses', () => {
      expect(shouldCacheResponse(400)).toBe(false);
      expect(shouldCacheResponse(401)).toBe(false);
      expect(shouldCacheResponse(403)).toBe(false);
      expect(shouldCacheResponse(404)).toBe(false);
      expect(shouldCacheResponse(409)).toBe(false);
    });

    test('should NOT cache 5xx responses', () => {
      expect(shouldCacheResponse(500)).toBe(false);
      expect(shouldCacheResponse(502)).toBe(false);
      expect(shouldCacheResponse(503)).toBe(false);
    });
  });

  describe('requestBodyMatches', () => {
    test('should return true for matching hashes', () => {
      expect(requestBodyMatches('abc123', 'abc123')).toBe(true);
    });

    test('should return false for non-matching hashes', () => {
      expect(requestBodyMatches('abc123', 'def456')).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should remove expired entries', (done) => {
      // Add entry with short TTL
      storeIdempotencyResponse({
        key: 'short-ttl-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
        ttlMs: 50,
      }, { status: 201, headers: {}, body: { data: 'test' } });

      // Add entry with long TTL
      storeIdempotencyResponse({
        key: 'long-ttl-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash2',
        ttlMs: 60000,
      }, { status: 201, headers: {}, body: { data: 'test2' } });

      expect(idempotencyStore.getSize()).toBe(2);

      setTimeout(() => {
        idempotencyStore.cleanup();
        
        // Short TTL should be removed
        const shortEntry = idempotencyStore.get('short-ttl-key');
        expect(shortEntry).toBeUndefined();
        
        // Long TTL should still exist
        const longEntry = idempotencyStore.get('long-ttl-key');
        expect(longEntry).toBeDefined();
        
        done();
      }, 100);
    });
  });

  describe('getSize and clear', () => {
    test('should return correct store size', () => {
      expect(idempotencyStore.getSize()).toBe(0);
      
      storeIdempotencyResponse({
        key: 'key-1',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { status: 201, headers: {}, body: { data: 'test' } });

      expect(idempotencyStore.getSize()).toBe(1);
    });

    test('should clear all entries', () => {
      storeIdempotencyResponse({
        key: 'key-1',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { status: 201, headers: {}, body: { data: 'test' } });

      storeIdempotencyResponse({
        key: 'key-2',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash2',
      }, { status: 201, headers: {}, body: { data: 'test2' } });

      idempotencyStore.clear();
      expect(idempotencyStore.getSize()).toBe(0);
    });
  });

  describe('startIdempotencyCleanup and stopIdempotencyCleanup', () => {
    test('should not throw when called multiple times', () => {
      startIdempotencyCleanup(1000);
      expect(() => startIdempotencyCleanup(1000)).not.toThrow();
      stopIdempotencyCleanup();
      // Should not throw if already stopped
      expect(() => stopIdempotencyCleanup()).not.toThrow();
    });
  });

  describe('Atomic reservation (first-write-wins)', () => {
    test('should return true for first write and false for duplicate', () => {
      const options = {
        key: 'atomic-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
      };

      const firstWrite = storeIdempotencyResponse(options, { status: 201, headers: {}, body: { data: 'first' } });
      expect(firstWrite).toBe(true);

      const secondWrite = storeIdempotencyResponse(options, { status: 201, headers: {}, body: { data: 'second' } });
      expect(secondWrite).toBe(false);

      // Verify the first value is preserved
      const result = getIdempotencyResponse<{ status: number; headers: Record<string, string>; body: { data: string } }>('atomic-key');
      expect(result?.body.data).toBe('first');
    });
  });

  describe('owner-aware reservation release', () => {
    test('does not delete a reservation reacquired by a different request', async () => {
      const values = new Map<string, string>();
      const redisKey = 'idempotency:release-key';
      values.set(redisKey, JSON.stringify({ requestId: 'new-owner' }));

      const client = new RedisIdempotencyClient();
      (client as any).connected = true;
      (client as any).client = {
        rawCommand: async (...args: string[]): Promise<number> => {
          expect(args[0]).toBe('EVAL');
          const key = args[3];
          const expectedRequestId = args[4];
          const stored = values.get(key);
          if (!stored) return 0;
          const data = JSON.parse(stored);
          if (data.requestId !== expectedRequestId || data.response) return 0;
          values.delete(key);
          return 1;
        },
      };

      await expect(client.releaseReservation('release-key', 'stale-owner')).resolves.toBe(false);
      expect(values.get(redisKey)).toContain('new-owner');

      await expect(client.releaseReservation('release-key', 'new-owner')).resolves.toBe(true);
      expect(values.has(redisKey)).toBe(false);
    });
  });
});
