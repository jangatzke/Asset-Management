import request from 'supertest';
import { app } from '../index';
import { phase6Service } from '../services/phase6.service';

jest.mock('../middleware/auth', () => ({ authenticate: (req: any, _res: any, next: any) => { req.userId = 'u1'; next(); }, authorize: () => (_req: any, _res: any, next: any) => next() }));
jest.mock('../middleware/entityAuth', () => ({
  requireWritePermission: (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  requireEntityPermission: () => (_req: any, _res: any, next: any) => next(),
  requireMappedReadPermission: () => (_req: any, _res: any, next: any) => next(),
  requireMappedWritePermission: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityWrite: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityRead: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityDelete: () => (_req: any, _res: any, next: any) => next(),
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../services/intune.scheduler', () => ({ initializeScheduler: () => ({ start: jest.fn() }) }));
jest.mock('../services/phase6.service', () => ({
  PHASE6_MODEL_MAP: { suppliers: {}, correctiveActions: {}, workflowInstances: {}, reportRuns: {} },
  phase6Service: { list: jest.fn(), create: jest.fn(), export: jest.fn(), runReminders: jest.fn(), createCorrectiveActionFromSource: jest.fn() },
}));
jest.mock('../services/supplier.service', () => ({
  supplierService: { list: jest.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }) },
}));

describe('Phase6 routes', () => {
  it('lists resource records via explicit supplier route', async () => {
    const res = await request(app).get('/api/v1/phase6/suppliers');
    expect(res.status).toBe(200);
  });

  it('rejects unknown resources', async () => {
    const res = await request(app).get('/api/v1/phase6/phase7');
    expect(res.status).toBe(404);
  });

  it('creates source-linked corrective actions', async () => {
    (phase6Service.createCorrectiveActionFromSource as jest.Mock).mockResolvedValue({ id: 'capa-1' });
    const res = await request(app).post('/api/v1/phase6/corrective-actions/from-source').send({ sourceType: 'audit', sourceId: 'finding-1', data: { title: 'Fix' } });
    expect(res.status).toBe(201);
  });
});
