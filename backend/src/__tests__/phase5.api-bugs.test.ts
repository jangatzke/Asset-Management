import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    req.userId = 'phase5-user';
    req.userScopes = ['*'];
    next();
  }),
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  authorizeEntityRead: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireEntityPermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
}));

const mockDisplayIdService = { nextDisplayIdStandalone: jest.fn() };
jest.mock('../services/displayId.service', () => ({ displayIdService: mockDisplayIdService }));

const mockAuditService = {
  logEventStandalone: jest.fn(),
  exportAuditLog: jest.fn(),
  queryAuditLog: jest.fn(),
  exportAuditLogAsCSV: jest.fn(),
};
jest.mock('../services/audit.service', () => ({ auditService: mockAuditService }));

const mockAuthorizationService = {
  require: jest.fn(),
  requireForScope: jest.fn(),
  buildReadFilter: jest.fn(),
};
jest.mock('../services/authorization.service', () => ({ authorizationService: mockAuthorizationService }));

jest.mock('../services/risk.aggregation', () => ({
  riskAggregationService: {
    aggregateByLocation: jest.fn(),
    aggregateByOrganizationUnit: jest.fn(),
    aggregateByBusinessProcess: jest.fn(),
    aggregateByAssetType: jest.fn(),
    aggregateByScope: jest.fn(),
    getUnifiedAggregation: jest.fn(),
    aggregateByService: jest.fn(),
    aggregateByRiskClass: jest.fn(),
    aggregateByStatus: jest.fn(),
    getDashboardSummary: jest.fn(),
  },
}));

const mockUserService = {
  listUsers: jest.fn(),
  getUserById: jest.fn(),
  searchUsers: jest.fn(),
  getOwnersForSelect: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};
jest.mock('../services/user.service', () => ({ UserService: jest.fn(() => mockUserService) }));

const mockIncidentService = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createSignificanceRuleVersion: jest.fn(),
  escalateOverdueDeadlines: jest.fn(),
  exportReportPackage: jest.fn(),
};
jest.mock('../services/incident.service', () => ({ incidentService: mockIncidentService }));

const mockRiskMethodService = {
  list: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createVersion: jest.fn(),
  listVersions: jest.fn(),
  findVersion: jest.fn(),
  calculateRiskScore: jest.fn(),
  recalculatePreview: jest.fn(),
  recalculatePreviewLegacy: jest.fn(),
  confirmRecalculation: jest.fn(),
  bulkConfirmRecalculation: jest.fn(),
};
jest.mock('../services/riskmethod.service', () => ({ riskMethodService: mockRiskMethodService }));

import { riskRouter } from '../routes/risk.routes';
import { auditLogRouter } from '../routes/auditLog.routes';
import { userRouter } from '../routes/user.routes';
import { serviceAccountRouter } from '../routes/serviceAccount.routes';
import { webhookRouter } from '../routes/webhook.routes';
import { incidentRouter } from '../routes/incident.routes';
import { riskMethodRouter } from '../routes/riskmethod.routes';
import { orgRouter } from '../routes/organization.routes';
import { riskAggregationService } from '../services/risk.aggregation';

const mockRiskAggregationService = riskAggregationService as jest.Mocked<typeof riskAggregationService>;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.userScopes = ['*'];
    next();
  });
  app.use('/risks', riskRouter);
  app.use('/audit-log', auditLogRouter);
  app.use('/users', userRouter);
  app.use('/service-accounts', serviceAccountRouter);
  app.use('/webhooks', webhookRouter);
  app.use('/incidents', incidentRouter);
  app.use('/methods', riskMethodRouter);
  app.use('/organization', orgRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
};

describe('Phase 5 API bug fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizationService.require.mockResolvedValue(undefined as never);
    mockAuthorizationService.buildReadFilter.mockResolvedValue({} as never);
    mockDisplayIdService.nextDisplayIdStandalone.mockResolvedValue('RSK-005' as never);
    mockAuditService.logEventStandalone.mockResolvedValue(undefined as never);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    // Ensure serviceAccount model exists on mockPrisma (required by serviceAccount.routes.ts)
    if (!(mockPrisma as any).serviceAccount) {
      (mockPrisma as any).serviceAccount = { findFirst: jest.fn(), update: jest.fn() };
    }
  });

  it('persists and reads Risk description and possibleImpact as distinct fields', async () => {
    const app = createApp();
    let storedRisk: any;
    mockPrisma.risk.create.mockImplementation(async ({ data }: any) => {
      storedRisk = { id: '550e8400-e29b-41d4-a716-446655440005', ...data };
      return storedRisk;
    });
    mockPrisma.risk.findUnique.mockImplementation(async ({ where }: any) => ({
      ...storedRisk,
      id: where.id,
      scenario: null,
      threat: null,
      vulnerability: null,
      causes: [],
      impacts: [],
      riskAssets: [],
      processLinks: [],
      serviceLinks: [],
      riskControls: [],
      treatments: [],
      reviewTasks: [],
      RiskAssessment: [],
      riskMethodVersion: null,
    }));

    const createResponse = await request(app).post('/risks').send({
      title: 'ERP ransomware risk',
      description: 'Ransomware auf ERP',
      possibleImpact: 'Produktionsstillstand für drei Tage',
      likelihood: 4,
      impact: 5,
      assessorId: 'assessor-1',
      riskOwnerId: 'owner-1',
      nextReviewDate: '2027-01-01T00:00:00.000Z',
      justification: 'Phase 5 persistence test',
    });

    expect(createResponse.status).toBe(201);
    expect(mockPrisma.risk.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        description: 'Ransomware auf ERP',
        possibleImpact: 'Produktionsstillstand für drei Tage',
      }),
    }));

    const readResponse = await request(app).get(`/risks/${createResponse.body.id}`);
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.description).toBe('Ransomware auf ERP');
    expect(readResponse.body.possibleImpact).toBe('Produktionsstillstand für drei Tage');
  });

  it('routes audit export before audit log id lookup', async () => {
    const app = createApp();
    mockAuditService.exportAuditLog.mockResolvedValue([{ id: 'audit-1' }] as never);
    mockPrisma.auditLog.findUnique.mockResolvedValue(null as never);

    const response = await request(app).get('/audit-log/export');

    expect(response.status).toBe(200);
    expect(mockAuditService.exportAuditLog).toHaveBeenCalled();
    expect(mockPrisma.auditLog.findUnique).not.toHaveBeenCalled();
  });

  it('routes user search and owners before user id lookup', async () => {
    const app = createApp();
    mockUserService.searchUsers.mockResolvedValue([{ id: 'user-1' }] as never);
    mockUserService.getOwnersForSelect.mockResolvedValue([{ id: 'owner-1' }] as never);

    await expect(request(app).get('/users/search?q=alice')).resolves.toHaveProperty('status', 200);
    await expect(request(app).get('/users/owners?q=bob')).resolves.toHaveProperty('status', 200);
    expect(mockUserService.searchUsers).toHaveBeenCalledWith('alice', 20);
    expect(mockUserService.getOwnersForSelect).toHaveBeenCalledWith('bob');
    expect(mockUserService.getUserById).not.toHaveBeenCalled();
  });

  it('routes service account auth before service account id routes', async () => {
    const app = createApp();
    mockPrisma.serviceAccount.findFirst.mockResolvedValue(null as never);
    const response = await request(app).post('/service-accounts/auth').send({ accessToken: 'invalid' });

    expect(response.status).toBe(401);
    // The authenticateServiceAccount middleware runs before the /auth route handler
    // and rejects requests without a Bearer token (expected behavior for this endpoint)
    expect(response.body.error?.code).toBe('MISSING_BEARER_TOKEN');
  });

  it('routes webhook broadcast before webhook id routes', async () => {
    const app = createApp();
    const response = await request(app).post('/webhooks/broadcast').send({ eventType: 'asset.created', data: { id: 'asset-1' } });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('routes incident report export before incident id lookup', async () => {
    const app = createApp();
    mockIncidentService.exportReportPackage.mockResolvedValue({ id: 'report-1' } as never);

    const response = await request(app).get('/incidents/reports/report-1/export');

    expect(response.status).toBe(200);
    expect(mockIncidentService.exportReportPackage).toHaveBeenCalledWith('report-1', 'phase5-user');
    expect(mockIncidentService.getById).not.toHaveBeenCalled();
  });

  it('routes risk method version endpoints before method id lookup', async () => {
    const app = createApp();
    mockRiskMethodService.findVersion.mockResolvedValue({ id: 'version-1' } as never);

    const response = await request(app).get('/methods/versions/version-1');

    expect(response.status).toBe(200);
    expect(mockRiskMethodService.findVersion).toHaveBeenCalledWith('version-1');
    expect(mockRiskMethodService.findById).not.toHaveBeenCalled();
  });

  it('routes risk review task update before risk id update', async () => {
    const app = createApp();
    mockPrisma.reviewTask.findUnique.mockResolvedValue({ id: 'task-1', riskId: 'risk-1' } as never);
    mockPrisma.reviewTask.update.mockResolvedValue({ id: 'task-1', status: 'completed' } as never);

    const response = await request(app).put('/risks/review-tasks/task-1').send({ status: 'completed' });

    expect(response.status).toBe(200);
    expect(mockPrisma.reviewTask.update).toHaveBeenCalled();
    expect(mockPrisma.risk.update).not.toHaveBeenCalled();
  });

  it('routes risk aggregation endpoints before nested riskId UUID validation', async () => {
    const app = createApp();
    mockRiskAggregationService.aggregateByLocation.mockResolvedValue([{ locationId: 'site-1', totalRisks: 1 }] as never);

    const response = await request(app).get('/risks/aggregated/by-location');

    expect(response.status).toBe(200);
    expect(mockRiskAggregationService.aggregateByLocation).toHaveBeenCalled();
    expect(mockPrisma.risk.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'aggregated' } }));
  });

  it('lists organization units for UI pickers', async () => {
    const app = createApp();
    mockPrisma.organizationUnit.findMany.mockResolvedValue([{ id: 'ou-1', name: 'Produktion' }] as never);

    const response = await request(app).get('/organization/units?q=prod&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 'ou-1', label: 'Produktion', name: 'Produktion' }]);
    expect(mockPrisma.organizationUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isArchived: false, name: { contains: 'prod', mode: 'insensitive' } },
      take: 5,
    }));
  });
});
