/**
 * Tests for Sub-Resource Pagination and Unified Query Validation
 *
 * Verifies that sub-resource endpoints (relations, dependencies, lifecycle-logs,
 * risk assessments, risk controls) validate query parameters through Zod
 * schemas, return paginated envelopes, and set the X-Total-Count header.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const paginationPayload = (data: any[]) => ({
  data,
  pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});

const mockAssetService = {
  getRelations: jest.fn(() => Promise.resolve({ sourceRelations: [], targetRelations: [], ...paginationPayload([]) })),
  getLifecycleLogs: jest.fn(() => Promise.resolve(paginationPayload([{ id: 'log-1' }]))),
  createRelation: jest.fn(),
};

const mockAssetGraphService = {
  getAssetGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  getDependencyGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  getDependencies: jest.fn(() => Promise.resolve({ upstream: [], downstream: [], ...paginationPayload([]) })),
  analyzeImpact: jest.fn(() => Promise.resolve({ affectedAssets: [] })),
};

jest.mock('../services/asset.service', () => ({
  assetService: mockAssetService,
}));

jest.mock('../services/asset.graph', () => ({
  assetGraphService: mockAssetGraphService,
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  authorize: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  authorizeEntityRead: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireEntityPermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireMappedReadPermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireMappedWritePermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireAdminAccess: jest.fn((req: any, _res: any, next: any) => next()),
}));

jest.mock('../config/database', () => ({
  prisma: {},
}));

import { assetRouter } from '../routes/asset.routes';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);

const ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';
const ASSET_PATH = `/assets/${ASSET_ID}`;

describe('Sub-Resource Pagination and Query Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /assets/:id/relations', () => {
    it('returns paginated envelope and X-Total-Count header', async () => {
      const response = await request(app).get(`${ASSET_PATH}/relations`);

      expect(response.status).toBe(200);
      expect(response.headers['x-total-count']).toBeDefined();
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(mockAssetService.getRelations).toHaveBeenCalledWith(ASSET_ID, expect.objectContaining({ page: 1, limit: 20 }));
    });

    it('rejects invalid pagination query params with 400 and Zod details', async () => {
      const response = await request(app).get(`${ASSET_PATH}/relations?limit=500`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(mockAssetService.getRelations).not.toHaveBeenCalled();
    });

    it('rejects non-numeric page values with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/relations?page=abc`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /assets/:id/lifecycle-logs', () => {
    it('returns paginated envelope and X-Total-Count header', async () => {
      const response = await request(app).get(`${ASSET_PATH}/lifecycle-logs`);

      expect(response.status).toBe(200);
      expect(response.headers['x-total-count']).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination.total).toBe(1);
    });

    it('rejects invalid sort order with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/lifecycle-logs?sortOrder=invalid`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockAssetService.getLifecycleLogs).not.toHaveBeenCalled();
    });
  });

  describe('GET /assets/:id/dependencies', () => {
    it('returns paginated payload and X-Total-Count header', async () => {
      const response = await request(app).get(`${ASSET_PATH}/dependencies`);

      expect(response.status).toBe(200);
      expect(response.headers['x-total-count']).toBeDefined();
      expect(response.body).toHaveProperty('upstream');
      expect(response.body).toHaveProperty('downstream');
      expect(response.body).toHaveProperty('pagination');
    });

    it('rejects invalid pagination query params with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/dependencies?limit=0`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockAssetGraphService.getDependencies).not.toHaveBeenCalled();
    });
  });

  describe('GET /assets/:id/graph (ad-hoc parsing replaced with Zod)', () => {
    it('accepts valid graph query parameters', async () => {
      const response = await request(app).get(`${ASSET_PATH}/graph?maxDepth=3&direction=upstream&relationTypes=depends_on,owns`);

      expect(response.status).toBe(200);
      expect(mockAssetGraphService.getDependencyGraph).toHaveBeenCalledWith(
        ASSET_ID,
        expect.objectContaining({ maxDepth: 3, direction: 'upstream', relationTypes: ['depends_on', 'owns'] }),
      );
    });

    it('rejects invalid direction values with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/graph?direction=sideways`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockAssetGraphService.getDependencyGraph).not.toHaveBeenCalled();
    });

    it('rejects maxDepth values above the allowed maximum with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/graph?maxDepth=999`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /assets/:id/impact-analysis', () => {
    it('accepts a valid maxDepth parameter', async () => {
      const response = await request(app).get(`${ASSET_PATH}/impact-analysis?maxDepth=4`);

      expect(response.status).toBe(200);
      expect(mockAssetGraphService.analyzeImpact).toHaveBeenCalledWith(ASSET_ID, { maxDepth: 4 });
    });

    it('rejects invalid maxDepth values with 400', async () => {
      const response = await request(app).get(`${ASSET_PATH}/impact-analysis?maxDepth=banana`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockAssetGraphService.analyzeImpact).not.toHaveBeenCalled();
    });
  });
});
