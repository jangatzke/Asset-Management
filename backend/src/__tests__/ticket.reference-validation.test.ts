import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEvent: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn().mockResolvedValue('TCKT-0002') }));

const { ticketService } = require('../services/ticket.service');

describe('Ticket reference integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.ticketTypeConfig.findUnique.mockResolvedValue(null);
    mockPrisma.ticket.create.mockResolvedValue({ id: 'ticket-2', displayId: 'TCKT-0002' });
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-2', displayId: 'TCKT-0002', type: 'incident', status: 'new', urgency: 'medium', impact: 'medium',
      requesterId: 'requester-1', assigneeId: null, managerId: null, isArchived: false,
    });
    mockPrisma.ticketAsset.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.ticketAsset.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.ticketHistoryEntry.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('rejects a non-existent requester before ticket creation', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await expect(ticketService.create({ type: 'incident', title: 'Missing requester', requesterId: 'missing-user' }, 'actor-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive assignee before ticket creation', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'assignee-1', isActive: false }]);

    await expect(ticketService.create({ type: 'incident', title: 'Inactive handler', assigneeId: 'assignee-1' }, 'actor-1'))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects unknown asset ids before ticket creation', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.asset.findMany.mockResolvedValue([]);

    await expect(ticketService.create({ type: 'incident', title: 'Unknown asset', assetIds: ['missing-asset'] }, 'actor-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
  });

  it('permits an explicit null requester for an unmapped external e-mail sender', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.ticket.findUnique.mockResolvedValueOnce({ id: 'ticket-2', isArchived: false });

    await ticketService.create({ type: 'incident', title: 'External sender', requesterId: null }, 'email-gateway');

    expect(mockPrisma.ticket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requesterId: null, createdBy: 'email-gateway' }),
    }));
  });

  it('records the affected asset ids when attaching assets so per-asset history can scope the event', async () => {
    mockPrisma.asset.findMany.mockResolvedValue([{ id: 'asset-1' }, { id: 'asset-2' }]);
    await ticketService.addAssets('ticket-2', ['asset-1', 'asset-2'], 'actor-1');

    expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket-2',
        action: 'ASSET_LINK',
        fieldChanges: { assetIds: ['asset-1', 'asset-2'] },
      }),
    });
  });

  it('records the affected asset ids when detaching assets', async () => {
    await ticketService.removeAssets('ticket-2', ['asset-1'], 'actor-1');

    expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket-2',
        action: 'ASSET_UNLINK',
        fieldChanges: { assetIds: ['asset-1'] },
      }),
    });
  });

  // ---- Update-path reference validation + optimistic locking -------------

  describe('update path', () => {
    beforeEach(() => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-2', displayId: 'TCKT-0002', type: 'incident', status: 'new',
        urgency: 'medium', impact: 'medium', version: 3, requesterId: 'requester-1',
        assigneeId: null, managerId: null, isArchived: false, comments: [],
      });
      mockPrisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    });

    it('requires the current `version` for an update (400 before any write)', async () => {
      await expect(ticketService.update('ticket-2', { title: 'No version' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.ticketHistoryEntry.create).not.toHaveBeenCalled();
    });

    it('rejects a non-existent requester on the update path before writing', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(ticketService.update('ticket-2', { version: 3, requesterId: 'missing-user' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.ticketHistoryEntry.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive manager on the update path before writing', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'manager-1', isActive: false }]);

      await expect(ticketService.update('ticket-2', { version: 3, managerId: 'manager-1' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
    });

    it('rejects unknown asset ids supplied on the update path', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([{ id: 'asset-1' }]);

      await expect(ticketService.update('ticket-2', { version: 3, assetIds: ['asset-1', 'missing-asset'] }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.ticketAsset.deleteMany).not.toHaveBeenCalled();
    });

    it('applies the update only while the expected version is still current', async () => {
      await ticketService.update('ticket-2', { version: 3, title: 'Retitled' }, 'actor-1');

      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: 'ticket-2', version: 3 },
        data: expect.objectContaining({ title: 'Retitled', updatedBy: 'actor-1', version: { increment: 1 } }),
      });
    });

    it('reports a 409 version conflict when a concurrent writer already incremented', async () => {
      mockPrisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      await expect(ticketService.update('ticket-2', { version: 3, title: 'Stale write' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('modified by another user') });
      expect(mockPrisma.ticketHistoryEntry.create).not.toHaveBeenCalled();
    });

    it('never validates unchanged user references on a title-only update', async () => {
      // The stub requester is inactive in the DB; a title-only update must not
      // touch requester validation (it would otherwise reject a valid edit).
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'requester-1', isActive: false }]);

      await ticketService.update('ticket-2', { version: 3, title: 'Retitled' }, 'actor-1');

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
