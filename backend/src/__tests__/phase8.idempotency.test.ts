import { 
  idempotencyStore, 
  validateIdempotencyKey, 
  storeIdempotencyResponse,
  getIdempotencyResponse,
  startIdempotencyCleanup,
  stopIdempotencyCleanup 
} from '../services/idempotency.service';

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
    test('should return stored response for valid key', () => {
      const responseData = { status: 201, body: { id: 'new-asset' }, headers: {} };
      
      storeIdempotencyResponse({
        key: 'unique-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, responseData);

      // The store wraps data in { data: { response, keyOptions, createdAt }, expiresAt }
      // getIdempotencyResponse returns entry?.data which is { response, keyOptions, createdAt }
      const result = getIdempotencyResponse<{ response: typeof responseData; keyOptions: unknown; createdAt: number }>('unique-key');
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.response).toEqual(responseData);
        expect(result.keyOptions).toHaveProperty('httpMethod', 'POST');
        expect(typeof result.createdAt).toBe('number');
      }
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
      }, { data: 'test' });

      setTimeout(() => {
        const result = getIdempotencyResponse('expiring-key');
        expect(result).toBeUndefined();
        done();
      }, 100);
    });
  });

  describe('validateIdempotencyKey', () => {
    test('should return true for valid stored key', () => {
      storeIdempotencyResponse({
        key: 'valid-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { data: 'test' });

      expect(validateIdempotencyKey('valid-key')).toBe(true);
    });

    test('should return false for non-existent key', () => {
      expect(validateIdempotencyKey('non-existent')).toBe(false);
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
      }, { data: 'test' });

      // Add entry with long TTL
      storeIdempotencyResponse({
        key: 'long-ttl-key',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash2',
        ttlMs: 60000,
      }, { data: 'test2' });

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
      }, { data: 'test' });

      expect(idempotencyStore.getSize()).toBe(1);
    });

    test('should clear all entries', () => {
      storeIdempotencyResponse({
        key: 'key-1',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash1',
      }, { data: 'test' });

      storeIdempotencyResponse({
        key: 'key-2',
        httpMethod: 'POST',
        routePattern: '/api/v1/assets',
        requestBodyHash: 'hash2',
      }, { data: 'test2' });

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
});
