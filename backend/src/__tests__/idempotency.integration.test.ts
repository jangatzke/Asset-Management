import request from 'supertest';
import express, { Application, Request, Response, NextFunction } from 'express';
import {
  idempotencyStore,
  IdempotencyEntry,
  generateIdempotencyKey,
  generateRequestBodyHash,
  stopIdempotencyCleanup,
} from '../services/idempotency.service';
import { RedisIdempotencyClient } from '../services/idempotency-redis-client';
import {
  clearInFlightReservations,
  getInFlightReservationCount,
  idempotency,
  IDEMPOTENCY_KEY_HEADER,
  setRedisClient,
} from '../middleware/idempotency';

function createMockRedisClient(get: (key: string) => Promise<string | null>): RedisIdempotencyClient {
  const client = new RedisIdempotencyClient();
  (client as any).connected = true;
  (client as any).client = {
    get,
    rawCommand: async (...args: string[]): Promise<string | null> => {
      // Return a non-null Redis-style non-success value so the client does not
      // fall through to its compatibility `set` call.
      if (args[0] === 'SET' && args.includes('NX')) return 'EXISTS';
      return 'OK';
    },
  };
  return client;
}

/**
 * Mock authentication middleware that sets req.userId.
 * Simulates what the real JWT authentication middleware does.
 */
function mockAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Simulate JWT decoding - in tests, accept any request and set a mock user ID
  (req as any).userId = 'test-user-123';
  next();
}

/**
 * Create a mock Express app with idempotency middleware.
 * This allows testing the middleware in isolation without database dependencies.
 */
function createMockApp(): Application {
  const app: Application = express();
  app.use(express.json());

  // Apply mock auth middleware BEFORE idempotency middleware
  // This simulates the real middleware chain where auth runs first
  app.use('/api/v1/test', mockAuthMiddleware);

  // Apply idempotency middleware to a test route
  app.use('/api/v1/test', idempotency());

  // Mock POST endpoint
  app.post('/api/v1/test/assets', (req: Request, res: Response) => {
    const body = req.body;
    res.status(201).json({
      success: true,
      data: { id: 'new-asset-123', ...body },
    });
  });

  // Mock PUT endpoint
  app.put('/api/v1/test/assets/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const body = req.body;
    res.status(200).json({
      success: true,
      data: { id, ...body, updated: true },
    });
  });

  // Mock endpoint that returns 400 (should NOT be cached)
  app.post('/api/v1/test/error', (req: Request, res: Response) => {
    res.status(400).json({
      success: false,
      error: {
        message: 'Bad request',
        code: 'VALIDATION_ERROR',
      },
    });
  });

  // Mock endpoint that returns 500 (should NOT be cached)
  app.post('/api/v1/test/server-error', (req: Request, res: Response) => {
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  });

  // Mock GET endpoint (should bypass idempotency)
  app.get('/api/v1/test/assets', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: [
        { id: 'asset-1', name: 'Asset 1' },
        { id: 'asset-2', name: 'Asset 2' },
      ],
    });
  });

  return app;
}

describe('Idempotency Middleware Integration', () => {
  const app = createMockApp();

  beforeEach(() => {
    idempotencyStore.clear();
    clearInFlightReservations();
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  afterEach(() => {
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  describe('Successful request caching (2xx/3xx)', () => {
    test('should cache and return same response for duplicate POST request', async () => {
      const idempotencyKey = 'unique-key-1';
      const requestBody = { name: 'New Asset', serialNumber: 'SN-001' };

      // First request - should process and cache
      const firstResponse = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(firstResponse.status).toBe(201);
      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.data.name).toBe('New Asset');
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request with same key - should return cached response
      const secondResponse = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(secondResponse.status).toBe(201);
      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(secondResponse.headers['x-idempotency-cache']).toBe('hit');
    });

    test('should cache and return same response for duplicate PUT request', async () => {
      const idempotencyKey = 'put-key-1';
      const requestBody = { name: 'Updated Asset' };

      // First request
      const firstResponse = await request(app)
        .put('/api/v1/test/assets/asset-123')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.data.updated).toBe(true);

      // Second request - should return cached response
      const secondResponse = await request(app)
        .put('/api/v1/test/assets/asset-123')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(secondResponse.headers['x-idempotency-cache']).toBe('hit');
    });
  });

  describe('Request body hash comparison', () => {
    test('should return 409 Conflict when idempotency key is reused with different body', async () => {
      const idempotencyKey = 'body-test-key';
      const requestBody1 = { name: 'Asset A' };
      const requestBody2 = { name: 'Asset B' };

      // First request with body 1
      const firstResponse = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody1);

      expect(firstResponse.status).toBe(201);

      // Second request with different body - should return 409
      const secondResponse = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody2);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.error.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
    });

    test('should return 409 when a completed key is reused with a different body', async () => {
      const idempotencyKey = 'completed-body-mismatch-key';

      await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send({ name: 'Original asset' })
        .expect(201);

      const response = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send({ name: 'Different asset' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
      expect(response.headers['x-idempotency-cache']).toBeUndefined();
    });

    test('should return cached response when idempotency key is reused with same body', async () => {
      const idempotencyKey = 'same-body-key';
      const requestBody = { name: 'Same Asset' };

      // First request
      await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      // Second request with same body - should return cached response
      const secondResponse = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(secondResponse.status).toBe(201);
      expect(secondResponse.headers['x-idempotency-cache']).toBe('hit');
    });
  });

  describe('Error responses (4xx/5xx) should NOT be cached', () => {
    test('should NOT cache 400 Bad Request responses', async () => {
      const idempotencyKey = 'error-key-1';

      // First request
      const firstResponse = await request(app)
        .post('/api/v1/test/error')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(firstResponse.status).toBe(400);
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request - should NOT return cached response (no X-Idempotency-Cache header)
      const secondResponse = await request(app)
        .post('/api/v1/test/error')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.headers['x-idempotency-cache']).toBeUndefined();
    });

    test('should NOT cache 500 Internal Server Error responses', async () => {
      const idempotencyKey = 'server-error-key';

      // First request
      const firstResponse = await request(app)
        .post('/api/v1/test/server-error')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(firstResponse.status).toBe(500);
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request - should NOT return cached response
      const secondResponse = await request(app)
        .post('/api/v1/test/server-error')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(secondResponse.status).toBe(500);
      expect(secondResponse.headers['x-idempotency-cache']).toBeUndefined();
    });

    test('releases the pending reservation after an error response', async () => {
      const idempotencyKey = 'released-error-key';

      await request(app)
        .post('/api/v1/test/error')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .expect(400);

      expect(getInFlightReservationCount()).toBe(0);
    });
  });

  describe('GET requests bypass idempotency', () => {
    test('should not apply idempotency to GET requests', async () => {
      const idempotencyKey = 'get-key';

      // First request
      const firstResponse = await request(app)
        .get('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request - should proceed normally (no caching)
      const secondResponse = await request(app)
        .get('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-idempotency-cache']).toBeUndefined();
    });
  });

  describe('No idempotency key provided', () => {
    test('should proceed normally when no idempotency key is provided', async () => {
      // First request without idempotency key
      const firstResponse = await request(app)
        .post('/api/v1/test/assets')
        .send({ name: 'No Key Asset' });

      expect(firstResponse.status).toBe(201);
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request without idempotency key - should proceed normally
      const secondResponse = await request(app)
        .post('/api/v1/test/assets')
        .send({ name: 'No Key Asset 2' });

      expect(secondResponse.status).toBe(201);
      expect(secondResponse.headers['x-idempotency-cache']).toBeUndefined();
    });
  });

  describe('Invalid idempotency key format', () => {
    test('should return 400 for invalid idempotency key format', async () => {
      const invalidKey = 'invalid key with spaces!@#$%';

      const response = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, invalidKey)
        .send({ name: 'Test Asset' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
    });
  });

  describe('Different keys for same endpoint', () => {
    test('should treat different keys as separate requests', async () => {
      const key1 = 'key-one';
      const key2 = 'key-two';
      const requestBody = { name: 'Test Asset' };

      // First request with key1
      const response1 = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key1)
        .send(requestBody);

      expect(response1.status).toBe(201);

      // Request with key2 - should NOT return cached (different key)
      const response2 = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key2)
        .send(requestBody);

      expect(response2.status).toBe(201);
      expect(response2.headers['x-idempotency-cache']).toBeUndefined();

      // Repeat with key1 - should return cached
      const response3 = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key1)
        .send(requestBody);

      expect(response3.status).toBe(201);
      expect(response3.headers['x-idempotency-cache']).toBe('hit');
    });
  });

  describe('Two identical requests (Supertest integration)', () => {
    test('should return cached response for two identical POST requests with same idempotency key', async () => {
      const idempotencyKey = 'integration-test-key';
      const requestBody = {
        name: 'Integration Test Asset',
        serialNumber: 'SN-INTEGRATION-001',
        assetTypeId: '550e8400-e29b-41d4-a716-446655440000',
      };

      // Send two identical requests with the same idempotency key
      const [firstResponse, secondResponse] = await Promise.all([
        request(app)
          .post('/api/v1/test/assets')
          .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
          .send(requestBody),
        request(app)
          .post('/api/v1/test/assets')
          .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
          .send(requestBody),
      ]);

      // Both should succeed
      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(201);

      // Both should have the same response body
      expect(secondResponse.body).toEqual(firstResponse.body);

      // First request should NOT have cache header (it was the original)
      expect(firstResponse.headers['x-idempotency-cache']).toBeUndefined();

      // Second request SHOULD have cache header (it was served from cache)
      expect(secondResponse.headers['x-idempotency-cache']).toBe('hit');

    });
  });

  describe('Distributed reservation regression coverage', () => {
    test('unwraps and replays the winner HTTP response from a Redis poll', async () => {
      const idempotencyKey = 'distributed-winner-key';
      const requestBody = { name: 'winner' };
      const compositeKey = generateIdempotencyKey(
        'test-user-123',
        'POST',
        '/api/v1/test/assets',
        idempotencyKey
      )!;
      const requestBodyHash = generateRequestBodyHash(requestBody);
      const pendingReservation = JSON.stringify({
        principal: 'test-user-123',
        httpMethod: 'POST',
        routePattern: '/api/v1/test/assets',
        requestId: 'other-instance',
        requestBodyHash,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      });
      const winningHttpResponse = {
        status: 201,
        headers: { 'x-winner': 'instance-a' },
        body: { success: true, data: { id: 'from-winner' } },
      };
      const completedReservation = JSON.stringify({
        ...JSON.parse(pendingReservation),
        response: {
          data: {
            response: winningHttpResponse,
            keyOptions: {
              ttlMs: 60_000,
              httpMethod: 'POST',
              routePattern: '/api/v1/test/assets',
              principal: 'test-user-123',
              requestBodyHash,
            },
            createdAt: Date.now(),
          },
          expiresAt: Date.now() + 60_000,
        } satisfies IdempotencyEntry,
      });
      let reads = 0;
      setRedisClient(createMockRedisClient(async (key) => {
        expect(key).toBe(`idempotency:${compositeKey}`);
        return ++reads === 1 ? pendingReservation : completedReservation;
      }));

      const response = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(response.status).toBe(winningHttpResponse.status);
      expect(response.body).toEqual(winningHttpResponse.body);
      expect(response.body).not.toHaveProperty('data.response');
      expect(response.headers['x-idempotency-cache']).toBe('waiting');
    });

    test('rejects a different body against a pending Redis reservation without waiting', async () => {
      const idempotencyKey = 'distributed-pending-mismatch-key';
      const originalBody = { name: 'original' };
      const requestBody = { name: 'different' };
      const compositeKey = generateIdempotencyKey(
        'test-user-123',
        'POST',
        '/api/v1/test/assets',
        idempotencyKey
      )!;
      const originalHash = generateRequestBodyHash(originalBody);
      let reads = 0;
      setRedisClient(createMockRedisClient(async () => {
        reads++;
        return JSON.stringify({
          principal: 'test-user-123',
          httpMethod: 'POST',
          routePattern: '/api/v1/test/assets',
          requestId: 'other-instance',
          requestBodyHash: originalHash,
          reservedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        });
      }));

      const response = await request(app)
        .post('/api/v1/test/assets')
        .set(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
        .send(requestBody);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
      expect(reads).toBe(1);
      expect(compositeKey).toBeDefined();
    });

    test('releasing an aborted reservation does not emit an unhandled rejection', async () => {
      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
      process.on('unhandledRejection', onUnhandledRejection);

      try {
        const abortApp = express();
        abortApp.use(express.json());
        abortApp.use(mockAuthMiddleware);
        abortApp.use(idempotency());
        abortApp.post('/abort', (req: Request, res: Response) => {
          req.emit('aborted');
          res.status(400).json({ success: false });
        });

        await request(abortApp)
          .post('/abort')
          .set(IDEMPOTENCY_KEY_HEADER, 'abort-safe-key')
          .send({ value: 'abort' })
          .expect(400);
        await new Promise(resolve => setImmediate(resolve));

        expect(unhandledRejections).toEqual([]);
        expect(getInFlightReservationCount()).toBe(0);
      } finally {
        process.off('unhandledRejection', onUnhandledRejection);
      }
    });
  });
});
