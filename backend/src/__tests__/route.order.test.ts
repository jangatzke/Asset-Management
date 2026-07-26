/**
 * Tests for Route Order (IAM-003)
 *
 * Verifies that static routes are defined before parametric routes
 * to prevent Express from matching literal segments as :id parameters.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock services
const mockAssetService = {
  list: jest.fn(() => Promise.resolve({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })),
  getAssetTypes: jest.fn(() => Promise.resolve([])),
  getById: jest.fn(() => Promise.resolve({ id: 'test-id', name: 'Test Asset' })),
  findIncompleteAssets: jest.fn(() => Promise.resolve([])),
};

const mockAssetGraphService = {
  getAssetGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
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

import { assetRouter } from '../routes/asset.routes';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);

describe('Route Order - Asset Routes (IAM-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static routes are matched before parametric routes', () => {
    it('GET /assets/types should match the static /types route, not /:id', async () => {
      const response = await request(app).get('/assets/types');

      expect(response.status).toBe(200);
      expect(mockAssetService.getAssetTypes).toHaveBeenCalled();
      expect(mockAssetService.getById).not.toHaveBeenCalled();
    });

    it('GET /assets/graph should match the static /graph route, not /:id', async () => {
      const response = await request(app).get('/assets/graph');

      expect(response.status).toBe(200);
      expect(mockAssetGraphService.getAssetGraph).toHaveBeenCalled();
      expect(mockAssetService.getById).not.toHaveBeenCalled();
    });

    it('GET /assets/incomplete should match the static /incomplete route, not /:id', async () => {
      const response = await request(app).get('/assets/incomplete');

      expect(response.status).toBe(200);
      expect(mockAssetService.findIncompleteAssets).toHaveBeenCalled();
      expect(mockAssetService.getById).not.toHaveBeenCalled();
    });

    it('POST /assets/import should match the static /import route, not /:id', async () => {
      const response = await request(app).post('/assets/import').send({});

      // Should not be treated as /:id/confirm-responsibility or similar
      expect(response.status).not.toBe(404);
    });

    it('GET /assets/:id should match the parametric route for valid UUID', async () => {
      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app).get(`/assets/${testUuid}`);

      expect(response.status).toBe(200);
      expect(mockAssetService.getById).toHaveBeenCalledWith(testUuid);
    });
  });
});
