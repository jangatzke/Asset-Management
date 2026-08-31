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
});
