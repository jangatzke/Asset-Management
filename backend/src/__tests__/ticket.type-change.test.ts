import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEvent: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn().mockResolvedValue('TCKT-0002') }));

const { ticketService } = require('../services/ticket.service');

describe('Ticket type changes', () => {
  const problemTicket = {
    id: 'ticket-2',
    displayId: 'TCKT-0002',
    type: 'problem',
    status: 'resolved',
    title: 'Root cause investigation',
    requesterId: 'requester-1',
    assigneeId: 'assignee-1',
    estimatedEffortUnits: 8,
    isArchived: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.ticket.findUnique.mockResolvedValue(problemTicket);
    mockPrisma.ticket.update.mockResolvedValue({ id: 'ticket-2' });
    mockPrisma.problem.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.change.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.serviceRequest.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.ticketHistoryEntry.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('replaces the extension and resets a Problem to the initial Change status', async () => {
    await ticketService.changeType('ticket-2', 'change', 'actor-1');

    expect(mockPrisma.problem.deleteMany).toHaveBeenCalledWith({ where: { ticketId: 'ticket-2' } });
    expect(mockPrisma.change.deleteMany).toHaveBeenCalledWith({ where: { ticketId: 'ticket-2' } });
    expect(mockPrisma.serviceRequest.deleteMany).toHaveBeenCalledWith({ where: { ticketId: 'ticket-2' } });
    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-2' },
      data: expect.objectContaining({
        type: 'change',
        status: 'draft',
        resolvedAt: null,
        closedAt: null,
        closedBy: null,
        change: { create: {} },
        updatedBy: 'actor-1',
        version: { increment: 1 },
      }),
    });
    expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket-2',
        action: 'TYPE_CHANGE',
        fieldChanges: {
          type: { old: 'problem', new: 'change' },
          status: { old: 'resolved', new: 'draft' },
        },
      }),
    });
  });

  it('rejects Incident ticket conversion', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue({ ...problemTicket, type: 'incident' });

    await expect(ticketService.changeType('ticket-2', 'service_request', 'actor-1'))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
