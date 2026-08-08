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

const mockCostPlanningService = {
  years: jest.fn(() => Promise.resolve({ years: [], current: { label: 'FY2026' } })),
  listPlans: jest.fn(() => Promise.resolve([])),
  createOrGetPlan: jest.fn(() => Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000', items: [], summary: {} })),
  getPlan: jest.fn(() => Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000', items: [], summary: {} })),
  candidates: jest.fn(() => Promise.resolve([])),
};
const mockSupplierService = {
  list: jest.fn(() => Promise.resolve({ data: [], pagination: { total: 0 } })),
  create: jest.fn(() => Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440001', legalName: 'Example Supplier' })),
};

const mockAssetGraphService = {
  getAssetGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  getDependencyGraph: jest.fn(() => Promise.resolve({ nodes: [{ id: 'test-id', name: 'Test Asset' }], edges: [] })),
};

const mockRequireAdminAccessMiddleware = jest.fn((_req: any, _res: any, next: any) => next());

const mockWebhookDelivery = {
  findMany: jest.fn(() => Promise.resolve([])),
  count: jest.fn(() => Promise.resolve(0)),
  findUnique: jest.fn(),
};

const mockWebhook = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

jest.mock('../services/asset.service', () => ({
  assetService: mockAssetService,
}));

jest.mock('../services/asset.graph', () => ({
  assetGraphService: mockAssetGraphService,
}));

jest.mock('../services/costPlanning.service', () => ({
  costPlanningService: mockCostPlanningService,
}));

jest.mock('../services/supplier.service', () => ({ supplierService: mockSupplierService }));

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
  requireAdminAccess: jest.fn((req: any, res: any, next: any) => mockRequireAdminAccessMiddleware(req, res, next)),
}));

jest.mock('../config/database', () => ({
  prisma: {
    webhook: mockWebhook,
    webhookDelivery: mockWebhookDelivery,
  },
}));

import { assetRouter } from '../routes/asset.routes';
import { costPlanningRouter } from '../routes/costPlanning.routes';
import { webhookRouter } from '../routes/webhook.routes';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);
app.use('/cost-planning', costPlanningRouter);
app.use('/api/v1/webhooks', webhookRouter);

describe('Route Order - Asset Routes (IAM-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminAccessMiddleware.mockImplementation((_req: any, _res: any, next: any) => next());
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

    it('GET /assets/:id accepts deterministic non-UUID asset IDs used by demo/import data', async () => {
      const deterministicId = 'demo-helio-asset-001';
      const response = await request(app).get(`/assets/${deterministicId}`);

      expect(response.status).toBe(200);
      expect(mockAssetService.getById).toHaveBeenCalledWith(deterministicId);
    });

    it('GET /assets/:id/graph uses asset read permission instead of admin-only access', async () => {
      mockRequireAdminAccessMiddleware.mockImplementation((_req: any, res: any, _next: any) => res.status(403).json({ error: 'admin required' }));

      const response = await request(app).get('/assets/demo-helio-asset-123/graph?direction=both&maxDepth=10');

      expect(response.status).toBe(200);
      expect(mockAssetGraphService.getDependencyGraph).toHaveBeenCalledWith('demo-helio-asset-123', expect.objectContaining({
        direction: 'both',
        maxDepth: 10,
      }));
    });
  });

  describe('Cost planning route contracts', () => {
    it('GET /cost-planning/plans/:id accepts empty query parameters used by the frontend detail loader', async () => {
      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app).get(`/cost-planning/plans/${testUuid}`);

      expect(response.status).toBe(200);
      expect(mockCostPlanningService.getPlan).toHaveBeenCalledWith(testUuid, {});
    });
  });
});

describe('Cost planning supplier endpoints', () => {
  it('searches active suppliers through the cost planning endpoint', async () => {
    const response = await request(app).get('/cost-planning/suppliers?search=example');

    expect(response.status).toBe(200);
    expect(mockSupplierService.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'example', status: 'active' }));
  });

  it('creates an inline supplier through the cost planning endpoint', async () => {
    const response = await request(app).post('/cost-planning/suppliers').send({ legalName: 'Example Supplier' });

    expect(response.status).toBe(201);
    expect(mockSupplierService.create).toHaveBeenCalledWith({ legalName: 'Example Supplier' }, 'user-123');
  });
});

describe('Route Order - Webhook Delivery Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebhookDelivery.findMany.mockResolvedValue([]);
    mockWebhookDelivery.count.mockResolvedValue(0);
  });

  it('GET /api/v1/webhooks/deliveries matches the delivery-list handler, not GET /:id', async () => {
    const response = await request(app).get('/api/v1/webhooks/deliveries');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });
    expect(mockWebhookDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(mockWebhookDelivery.count).toHaveBeenCalledWith({ where: {} });
    expect(mockWebhook.findUnique).not.toHaveBeenCalled();
  });
});
