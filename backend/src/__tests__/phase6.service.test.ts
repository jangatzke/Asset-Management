import { phase6Service } from '../services/phase6.service';
import { prisma } from '../config/database';

jest.mock('../config/database', () => {
  const model = () => ({ findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() });
  return { prisma: { supplier: model(), correctiveAction: model(), metricDefinition: model(), metricValue: model(), workflowDefinition: model(), workflowInstance: model(), workflowTransitionLog: model(), workflowTask: model(), reportRun: model(), exportJob: model(), auditLog: model() } };
});

describe('Phase6Service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates suppliers with display id and audit log', async () => {
    (prisma as any).supplier.create.mockResolvedValue({ id: 'sup-1', displayId: 'SUP-1', legalName: 'Provider' });
    (prisma as any).auditLog.create.mockResolvedValue({});
    const created = await phase6Service.create('suppliers', { legalName: 'Provider', criticality: 'high' }, 'user-1');
    expect(created.id).toBe('sup-1');
    expect((prisma as any).supplier.create.mock.calls[0][0].data.displayId).toMatch(/^SUP-/);
    expect((prisma as any).auditLog.create).toHaveBeenCalled();
  });

  it('creates corrective actions from allowed sources only', async () => {
    (prisma as any).correctiveAction.create.mockResolvedValue({ id: 'capa-1', sourceType: 'audit', sourceId: 'finding-1' });
    (prisma as any).auditLog.create.mockResolvedValue({});
    await expect(phase6Service.createCorrectiveActionFromSource('audit', 'finding-1', { title: 'Fix', description: 'Fix it', ownerId: 'u1', dueDate: new Date() }, 'u1')).resolves.toMatchObject({ id: 'capa-1' });
    await expect(phase6Service.createCorrectiveActionFromSource('phase7', 'x', {}, 'u1')).rejects.toThrow('Unsupported corrective action source');
  });

  it('detects metric threshold breaches and trend', async () => {
    (prisma as any).metricDefinition.findUnique.mockResolvedValue({ thresholds: { warningMax: 80, criticalMax: 90 } });
    (prisma as any).metricValue.findFirst.mockResolvedValue({ value: 70 });
    (prisma as any).metricValue.create.mockImplementation(async ({ data }: any) => ({ id: 'mv-1', ...data }));
    (prisma as any).auditLog.create.mockResolvedValue({});
    const value = await phase6Service.create('metricValues', { metricId: 'm-1', value: 95 }, 'u1');
    expect(value.breachStatus).toBe('critical');
    expect(value.trend).toBe('up');
  });

  it('exports rows as CSV and persists export job', async () => {
    (prisma as any).supplier.findMany.mockResolvedValue([{ id: '1', legalName: 'Provider' }]);
    (prisma as any).supplier.count.mockResolvedValue(1);
    (prisma as any).exportJob.create.mockImplementation(async ({ data }: any) => ({ id: 'exp-1', ...data }));
    (prisma as any).auditLog.create.mockResolvedValue({});
    const job = await phase6Service.export('suppliers', { format: 'csv' }, 'u1');
    expect(job.payload).toContain('legalName');
    expect(job.status).toBe('completed');
  });
});
