/**
 * Asset history regression tests.
 *
 * Verifies that GET /api/v1/assets/:id/history merges the asset's own entity
 * history with ticket-history events that *reference this specific asset*
 * (via recorded `fieldChanges.assetIds` or a current TicketAsset link for
 * legacy ASSET_LINK events) into a single, chronologically ordered feed — and
 * excludes ticket events that only belong to other assets on the same ticket.
 */

const mockPrisma: any = {
  asset: {
    findUnique: jest.fn(),
  },
  entityHistoryEntry: {
    findMany: jest.fn(),
  },
  ticketAsset: {
    findMany: jest.fn(),
  },
  ticketHistoryEntry: {
    findMany: jest.fn(),
  },
  ticket: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

import { assetService } from '../services/asset.service';

describe('Asset history (entity + asset-referencing ticket events)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.asset.findUnique.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.ticket.findMany.mockResolvedValue([]);
  });

  it('shows ticket events that reference the asset, with asset-perspective phrasing', async () => {
    mockPrisma.ticketAsset.findMany.mockResolvedValue([{ assetId: 'asset-1', ticketId: 'ticket-1' }]);
    mockPrisma.ticketHistoryEntry.findMany.mockResolvedValue([
      {
        id: 'h-link',
        ticketId: 'ticket-1',
        action: 'ASSET_LINK',
        fieldChanges: { assetIds: ['asset-1'] },
        summary: 'Attached 1 asset(s) to TCKT-0002',
        actorId: 'user-2',
        actorName: 'Grace Hopper',
        createdAt: new Date('2024-01-02T10:00:00Z'),
      },
    ]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-1', displayId: 'TCKT-0002' }]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([]);

    const result = await assetService.getAssetTicketHistory('asset-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'h-link',
        entityType: 'Ticket',
        action: 'ASSET_LINK',
        summary: 'Attached to TCKT-0002',
        source: 'ticket',
        ticketId: 'ticket-1',
        ticketDisplayId: 'TCKT-0002',
      })
    );
  });

  it('excludes ticket events that only reference other assets on the same ticket', async () => {
    // Ticket TCKT-0003 involves asset-1 AND asset-2. The ASSET_LINK event only
    // attached asset-2, so it must NOT appear in asset-1's history.
    mockPrisma.ticketAsset.findMany.mockResolvedValue([
      { assetId: 'asset-1', ticketId: 'ticket-3' },
      { assetId: 'asset-2', ticketId: 'ticket-3' },
    ]);
    mockPrisma.ticketHistoryEntry.findMany.mockResolvedValue([
      {
        id: 'h-other',
        ticketId: 'ticket-3',
        action: 'ASSET_LINK',
        fieldChanges: { assetIds: ['asset-2'] },
        summary: 'Attached 1 asset(s) to TCKT-0003',
        actorId: 'user-2',
        actorName: 'Grace Hopper',
        createdAt: new Date('2024-01-02T10:00:00Z'),
      },
      {
        id: 'h-mine',
        ticketId: 'ticket-3',
        action: 'ASSET_UNLINK',
        fieldChanges: { assetIds: ['asset-1'] },
        summary: 'Detached 1 asset(s) from TCKT-0003',
        actorId: 'user-2',
        actorName: 'Grace Hopper',
        createdAt: new Date('2024-01-03T10:00:00Z'),
      },
    ]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-3', displayId: 'TCKT-0003' }]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([]);

    const result = await assetService.getAssetTicketHistory('asset-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('h-mine');
    expect(result[0].summary).toBe('Detached from TCKT-0003');
  });

  it('keeps legacy ASSET_LINK events (no recorded asset ids) for still-linked tickets', async () => {
    mockPrisma.ticketAsset.findMany.mockResolvedValue([{ assetId: 'asset-1', ticketId: 'ticket-1' }]);
    mockPrisma.ticketHistoryEntry.findMany.mockResolvedValue([
      {
        id: 'h-legacy',
        ticketId: 'ticket-1',
        action: 'ASSET_LINK',
        fieldChanges: {},
        summary: 'Attached 1 asset(s) to TCKT-0002',
        actorId: 'user-2',
        actorName: 'Grace Hopper',
        createdAt: new Date('2024-01-02T10:00:00Z'),
      },
      {
        id: 'h-unrelated',
        ticketId: 'ticket-1',
        action: 'STATUS_CHANGE',
        fieldChanges: { status: { old: 'new', new: 'in_progress' } },
        summary: 'Changed new to in_progress',
        actorId: 'user-2',
        actorName: 'Grace Hopper',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
    ]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-1', displayId: 'TCKT-0002' }]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([]);

    const result = await assetService.getAssetTicketHistory('asset-1');

    // Only the legacy ASSET_LINK is attributed; the generic status change is not.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('h-legacy');
    expect(result[0].summary).toBe('Attached to TCKT-0002');
  });

  it('merges asset entity history with asset-referencing ticket events, newest first', async () => {
    mockPrisma.ticketAsset.findMany.mockResolvedValue([{ assetId: 'asset-1', ticketId: 'ticket-1' }]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([{
      id: 'h-asset',
      entityType: 'Asset',
      entityId: 'asset-1',
      action: 'UPDATE',
      fieldChanges: { name: { old: 'A', new: 'B' } },
      summary: 'Updated fields: name',
      actorId: 'user-1',
      actorName: 'Ada Lovelace',
      createdAt: new Date('2024-01-01T10:00:00Z'),
    }]);
    mockPrisma.ticketHistoryEntry.findMany.mockResolvedValue([{
      id: 'h-ticket',
      ticketId: 'ticket-1',
      action: 'ASSET_LINK',
      fieldChanges: { assetIds: ['asset-1'] },
      summary: 'Attached 1 asset(s) to TCKT-0002',
      actorId: 'user-2',
      actorName: 'Grace Hopper',
      createdAt: new Date('2024-01-02T10:00:00Z'),
    }]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-1', displayId: 'TCKT-0002' }]);

    const result = await assetService.getAssetTicketHistory('asset-1');

    expect(result).toHaveLength(2);
    // Newest first: ticket event (Jan 2) before entity update (Jan 1).
    expect(result[0].id).toBe('h-ticket');
    expect(result[0]).toEqual(
      expect.objectContaining({ entityType: 'Ticket', source: 'ticket', ticketId: 'ticket-1', ticketDisplayId: 'TCKT-0002' })
    );
    expect(result[1].id).toBe('h-asset');
    expect(result[1]).toEqual(
      expect.objectContaining({ entityType: 'Asset', source: 'asset' })
    );
  });

  it('returns only entity history when the asset has no ticket links', async () => {
    mockPrisma.ticketAsset.findMany.mockResolvedValue([]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([{
      id: 'h-asset',
      entityType: 'Asset',
      entityId: 'asset-1',
      action: 'CREATE',
      fieldChanges: {},
      summary: 'Created Asset',
      actorId: 'user-1',
      actorName: 'Ada Lovelace',
      createdAt: new Date('2024-01-01T10:00:00Z'),
    }]);

    const result = await assetService.getAssetTicketHistory('asset-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('h-asset');
    expect(mockPrisma.ticketHistoryEntry.findMany).not.toHaveBeenCalled();
  });

  it('applies the action filter to asset-referencing ticket entries', async () => {
    mockPrisma.ticketAsset.findMany.mockResolvedValue([{ assetId: 'asset-1', ticketId: 'ticket-1' }]);
    mockPrisma.entityHistoryEntry.findMany.mockResolvedValue([]);
    mockPrisma.ticketHistoryEntry.findMany.mockResolvedValue([
      { id: 't-link', action: 'ASSET_LINK', fieldChanges: { assetIds: ['asset-1'] }, summary: 's', createdAt: new Date('2024-01-02T10:00:00Z') },
      { id: 't-status', action: 'STATUS_CHANGE', fieldChanges: { assetIds: ['asset-1'] }, summary: 's', createdAt: new Date('2024-01-03T10:00:00Z') },
    ]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-1', displayId: 'TCKT-0002' }]);

    const result = await assetService.getAssetTicketHistory('asset-1', { action: 'ASSET_LINK' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-link');
    // The action filter must also be pushed into the entity-history query.
    expect(mockPrisma.entityHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'ASSET_LINK' }) })
    );
  });

  it('throws 404 for unknown asset', async () => {
    mockPrisma.asset.findUnique.mockResolvedValue(null);

    await expect(assetService.getAssetTicketHistory('missing')).rejects.toThrow();
  });
});
