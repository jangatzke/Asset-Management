/**
 * Phase 1.3 (D2) — Idempotency on core-entity mutations.
 *
 * Verifies the router-level mounting:
 *  - Requests WITHOUT an Idempotency-Key run unchanged (no 400/409).
 *  - Requests WITH the same key are deduplicated (cached response / 409 on body mismatch).
 *  - GET requests are never affected, even when a key header is present.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockAssetService = {
  create: jest.fn(async (body: any) => ({ id: 'asset-created-1', ...body })),
  list: jest.fn(async () => ({
    data: [{ id: 'asset-1' }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })),
  archive: jest.fn(async () => ({ success: true })),
};

const mockAssetGraphService = {
  getDependencyGraph: jest.fn(),
  analyzeImpact: jest.fn(),
  getDependencies: jest.fn(),
};

const mockAuthorizationService = {
  buildReadFilter: jest.fn(async () => ({})),
  requireForEntity: jest.fn(async () => undefined),
};

jest.mock('../services/asset.service', () => ({ assetService: mockAssetService }));
jest.mock('../services/asset.graph', () => ({ assetGraphService: mockAssetGraphService }));
jest.mock('../services/authorization.service', () => ({ authorizationService: mockAuthorizationService }));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireEntityPermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Keep the test focused on idempotency: skip Zod body/query validation.
jest.mock('../middleware/validation', () => ({
  validateBody: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateParams: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateQuery: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../config/database', () => ({ prisma: {} }));

import { assetRouter } from '../routes/asset.routes';
import {
  idempotency,
  IDEMPOTENCY_KEY_HEADER,
  clearInFlightReservations,
  setRedisClient,
} from '../middleware/idempotency';
import { idempotencyStore, stopIdempotencyCleanup } from '../services/idempotency.service';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);

const validAssetBody = { name: 'Core Router' };

describe('Idempotency on D2 core mutations (router-level mount)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStore.clear();
    clearInFlightReservations();
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  afterEach(() => {
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  describe('requests without Idempotency-Key', () => {
    it('runs POST /assets unchanged — no 400/409, no cache header', async () => {
      const first = await request(app).post('/assets').send(validAssetBody);
      const second = await request(app).post('/assets').send(validAssetBody);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.headers['x-idempotency-cache']).toBeUndefined();
      expect(second.headers['x-idempotency-cache']).toBeUndefined();
      expect(mockAssetService.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('requests with Idempotency-Key', () => {
    it('deduplicates the second POST /assets with the same key and body', async () => {
      const key = 'phase-1-3-asset-create-key';

      const first = await request(app)
        .post('/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(validAssetBody);
      const second = await request(app)
        .post('/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(validAssetBody);

      expect(first.status).toBe(201);
      expect(first.headers['x-idempotency-cache']).toBeUndefined();
      expect(second.status).toBe(201);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(second.body).toEqual(first.body);
      // Only the winning request executed the business operation.
      expect(mockAssetService.create).toHaveBeenCalledTimes(1);
    });

    it('returns 409 when the same key is reused with a different body', async () => {
      const key = 'phase-1-3-asset-body-mismatch-key';

      const first = await request(app)
        .post('/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ name: 'First asset' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/assets')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ name: 'Different asset' });

      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
      expect(mockAssetService.create).toHaveBeenCalledTimes(1);
    });

    it('protects POST /assets/bulk-archive', async () => {
      const key = 'phase-1-3-bulk-archive-key';
      const body = { ids: ['asset-1'], reason: 'cleanup' };

      const first = await request(app)
        .post('/assets/bulk-archive')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);
      const second = await request(app)
        .post('/assets/bulk-archive')
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockAssetService.archive).toHaveBeenCalledTimes(1);
    });
  });

  describe('reads are not affected', () => {
    it('ignores Idempotency-Key on GET /assets', async () => {
      const key = 'phase-1-3-read-key';

      const first = await request(app).get('/assets').set(IDEMPOTENCY_KEY_HEADER, key);
      const second = await request(app).get('/assets').set(IDEMPOTENCY_KEY_HEADER, key);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.headers['x-idempotency-cache']).toBeUndefined();
      expect(second.headers['x-idempotency-cache']).toBeUndefined();
      expect(mockAssetService.list).toHaveBeenCalledTimes(2);
    });
  });
});

// Ensure the exported middleware is still importable/composable for future mounts.
void idempotency;
