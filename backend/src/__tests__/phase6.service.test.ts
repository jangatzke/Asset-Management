import { phase6Service } from '../services/phase6.service';
import { prisma } from '../config/database';

jest.mock('../config/database', () => {
  const model = () => ({ findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() });
  const prisma: any = { supplier: model(), correctiveAction: model(), metricDefinition: model(), metricValue: model(), workflowDefinition: model(), workflowInstance: model(), workflowTransitionLog: model(), workflowTask: model(), reportRun: model(), exportJob: model(), auditLog: model() };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return { prisma };
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

  it('accepts BCP as a corrective action source while retaining source allow-list validation', async () => {
    (prisma as any).correctiveAction.create.mockResolvedValue({ id: 'capa-bcp-1', sourceType: 'bcp', sourceId: 'bcp-1' });
    (prisma as any).auditLog.create.mockResolvedValue({});
    await expect(phase6Service.createCorrectiveActionFromSource('bcp', 'bcp-1', { title: 'Exercise finding', description: 'Recoverability gap', ownerId: 'u1', dueDate: new Date() }, 'u1')).resolves.toMatchObject({ sourceType: 'bcp' });
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

  it('starts workflows only for the entity type supported by their definition', async () => {
    (prisma as any).workflowDefinition.findUnique.mockResolvedValue({ id: 'definition-1', name: 'Risk review', entityType: 'risk', states: [{ key: 'draft' }], dueDateRules: {} });
    (prisma as any).workflowInstance.create.mockImplementation(async ({ data }: any) => ({ id: 'instance-1', ...data }));
    (prisma as any).auditLog.create.mockResolvedValue({});

    await expect(phase6Service.startWorkflow('definition-1', { entityType: 'asset', entityId: 'asset-1' }, 'user-1')).rejects.toThrow('must match the workflow definition');
    await expect(phase6Service.startWorkflow('definition-1', { entityType: 'risk', entityId: 'risk-1' }, 'user-1')).resolves.toMatchObject({ entityType: 'risk', entityId: 'risk-1' });
  });

  it('returns only the allowed labeled actions for the instance current state', async () => {
    (prisma as any).workflowInstance.findUnique.mockResolvedValue({ id: 'instance-1', definitionId: 'definition-1', currentState: 'review' });
    (prisma as any).workflowDefinition.findUnique.mockResolvedValue({ transitions: [{ key: 'approve', label: 'Approve', from: 'review', to: 'approved' }, { key: 'reject', name: 'Reject', from: 'review', to: 'draft' }, { key: 'publish', from: 'approved', to: 'completed' }] });

    await expect(phase6Service.getWorkflowActions('instance-1')).resolves.toEqual([{ key: 'approve', label: 'Approve' }, { key: 'reject', label: 'Reject' }]);
  });

  it('falls back to KRI and aggregates only active definitions in the KRI board', async () => {
    (prisma as any).metricDefinition.findMany.mockResolvedValue([]);
    const board = await phase6Service.kriBoard('bogus');
    expect(board.metricType).toBe('KRI');
    expect((prisma as any).metricDefinition.findMany).toHaveBeenCalledWith({ where: { metricType: 'KRI', status: 'active' }, orderBy: { name: 'asc' } });
    expect(board.summary).toEqual({ critical: 0, warning: 0, none: 0, noData: 0 });
    expect(board.items).toEqual([]);
  });

  it('recomputes breaches from current thresholds and derives trend, sparkline and summary in the KRI board', async () => {
    (prisma as any).metricDefinition.findMany.mockResolvedValue([
      { id: 'm-1', displayId: 'MET-1', name: 'Patch latency', metricType: 'KRI', unit: '%', aggregation: 'latest', thresholds: { warningMax: 80, criticalMax: 90 }, objectiveId: null },
      { id: 'm-2', displayId: 'MET-2', name: 'Open findings', metricType: 'KRI', unit: null, aggregation: 'latest', thresholds: {}, objectiveId: null },
    ]);
    (prisma as any).metricValue.findMany.mockImplementation(async ({ where }: any) =>
      where.metricId === 'm-1'
        ? [
            { id: 'v-2', value: 95, measuredAt: new Date('2026-10-01'), source: 'manual' },
            { id: 'v-1', value: 70, measuredAt: new Date('2026-09-01'), source: null },
          ]
        : []);

    const board = await phase6Service.kriBoard('KRI');
    expect(board.metricType).toBe('KRI');
    expect(board.items[0]).toMatchObject({ id: 'm-1', displayId: 'MET-1', breachStatus: 'critical', trend: 'up' });
    expect(board.items[0].latestValue).toMatchObject({ value: 95, source: 'manual' });
    // Sparkline is ordered oldest -> newest for chart rendering.
    expect(board.items[0].sparkline.map((row: any) => row.value)).toEqual([70, 95]);
    // No measurements at all -> no breach evaluation, counted as noData in the summary.
    expect(board.items[1].latestValue).toBeNull();
    expect(board.summary).toEqual({ critical: 1, warning: 0, none: 0, noData: 1 });
  });

  it('honors an explicit KPI type for the KRI board', async () => {
    (prisma as any).metricDefinition.findMany.mockResolvedValue([]);
    const board = await phase6Service.kriBoard('KPI');
    expect(board.metricType).toBe('KPI');
    expect((prisma as any).metricDefinition.findMany).toHaveBeenCalledWith({ where: { metricType: 'KPI', status: 'active' }, orderBy: { name: 'asc' } });
  });
});
