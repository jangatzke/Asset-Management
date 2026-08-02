/**
 * Generic Entity History regression tests.
 *
 * These tests focus on the reusable non-incident history service so existing
 * Incident History semantics remain covered by incident.history.test.ts.
 */

const mockPrisma: any = {
  entityHistoryEntry: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

import {
  computeFieldDiff,
  getEntityHistory,
  recordCreateHistory,
  recordDeleteHistory,
  recordUpdateHistory,
  toHistoryData,
} from '../services/entityHistory.service';

describe('Generic Entity History', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  it('creates a history entry on entity creation with actor attribution', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' });

    await recordCreateHistory({
      entityType: 'Risk',
      entityId: 'risk-1',
      data: { title: 'Supplier outage' },
      actorId: 'user-1',
    });

    expect(mockPrisma.entityHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Risk',
        entityId: 'risk-1',
        action: 'CREATE',
        summary: 'Created Risk: Supplier outage',
        actorId: 'user-1',
        actorName: 'Ada Lovelace',
      }),
    });
  });

  it('creates one summarized status-change entry when status and other fields change', async () => {
    await recordUpdateHistory({
      entityType: 'Control',
      entityId: 'control-1',
      oldData: { title: 'Old title', status: 'planned', description: 'Old' },
      newData: { title: 'New title', status: 'implemented', description: 'Old' },
      statusField: 'status',
      actorId: 'user-1',
    });

    expect(mockPrisma.entityHistoryEntry.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.entityHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Control',
        entityId: 'control-1',
        action: 'STATUS_CHANGE',
        summary: 'Status changed from planned to implemented; updated fields: title',
        fieldChanges: {
          oldStatus: 'planned',
          newStatus: 'implemented',
          title: { old: 'Old title', new: 'New title' },
        },
        actorId: 'user-1',
      }),
    });
  });

  it('creates one update entry for non-status field changes', async () => {
    await recordUpdateHistory({
      entityType: 'License',
      entityId: 'license-1',
      oldData: { title: 'License A', status: 'active', seats: 10 },
      newData: { title: 'License A', status: 'active', seats: 20 },
      statusField: 'status',
    });

    expect(mockPrisma.entityHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        summary: 'Updated fields: seats',
        fieldChanges: { seats: { old: 10, new: 20 } },
      }),
    });
  });

  it('does not create false history entries for unchanged or ignored fields', async () => {
    const result = await recordUpdateHistory({
      entityType: 'Asset',
      entityId: 'asset-1',
      oldData: { name: 'Server 1', lifecycleStatus: 'active', updatedAt: new Date('2024-01-01') },
      newData: { name: 'Server 1', lifecycleStatus: 'active', updatedAt: new Date('2024-02-01') },
      statusField: 'lifecycleStatus',
    });

    expect(result).toEqual({ action: 'UPDATE', summary: '' });
    expect(mockPrisma.entityHistoryEntry.create).not.toHaveBeenCalled();
  });

  it('filters and paginates history retrieval', async () => {
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([{ id: 'h1' }]);

    const result = await getEntityHistory('Process', 'process-1', {
      action: 'UPDATE',
      limit: 10,
      offset: 20,
    });

    expect(result).toEqual([{ id: 'h1' }]);
    expect(mockPrisma.entityHistoryEntry.findMany).toHaveBeenCalledWith({
      where: { entityType: 'Process', entityId: 'process-1', action: 'UPDATE' },
      orderBy: { createdAt: 'asc' },
      take: 10,
      skip: 20,
    });
  });

  it('records delete history entries for archive/delete operations', async () => {
    await recordDeleteHistory({ entityType: 'Contract', entityId: 'contract-1', actorId: 'user-1' });

    expect(mockPrisma.entityHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Contract',
        entityId: 'contract-1',
        action: 'DELETE',
        summary: 'Deleted Contract',
        actorId: 'user-1',
      }),
    });
  });

  it('normalizes fetched entities to scalar history data before diffing', () => {
    const normalized = toHistoryData({
      id: 'asset-1',
      name: 'Server 1',
      owner: { id: 'user-1' },
      tags: ['prod'],
      createdAt: new Date('2024-01-01'),
      status: 'active',
    });

    expect(normalized).toEqual({ name: 'Server 1', status: 'active' });
    expect(computeFieldDiff({ status: 'active' }, { status: 'active' })).toEqual({});
  });
});
