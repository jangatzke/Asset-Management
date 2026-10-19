import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEvent: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn().mockResolvedValue('TCKT-0100') }));

const { ticketService } = require('../services/ticket.service');

describe('Ticket problem/change extension services', () => {
  const baseTicket = {
    id: 'ticket-1',
    displayId: 'TCKT-0001',
    type: 'problem',
    status: 'new',
    title: 'Printer outage investigation',
    description: 'Recurring printer failures',
    priority: 'medium',
    urgency: 'medium',
    impact: 'low',
    requesterId: 'requester-1',
    assigneeId: null,
    managerId: null,
    isArchived: false,
    problem: null,
    change: null,
    assets: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.ticketHistoryEntry.create.mockResolvedValue({});
    mockPrisma.problem.update.mockResolvedValue({});
    mockPrisma.problem.create.mockResolvedValue({});
    mockPrisma.change.update.mockResolvedValue({});
    mockPrisma.change.create.mockResolvedValue({});
    mockPrisma.changeRiskLink.upsert.mockResolvedValue({});
    mockPrisma.changeRiskLink.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('updateProblem', () => {
    it('rejects tickets without a problem extension with 409', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, type: 'change' });

      await expect(ticketService.updateProblem('ticket-1', { rootCause: 'driver bug' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the extension row when missing and strips undefined fields', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicket);

      await ticketService.updateProblem('ticket-1', { rootCause: 'driver bug', workaround: undefined }, 'actor-1');

      expect(mockPrisma.problem.create).toHaveBeenCalledWith({
        data: { ticketId: 'ticket-1', rootCause: 'driver bug' },
      });
      expect(mockPrisma.problem.update).not.toHaveBeenCalled();
      expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ticketId: 'ticket-1', action: 'UPDATE' }),
      });
    });

    it('updates the existing extension row', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, problem: { id: 'problem-1' } });

      await ticketService.updateProblem('ticket-1', { permanentFix: 'replace firmware' }, 'actor-1');

      expect(mockPrisma.problem.update).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1' },
        data: { permanentFix: 'replace firmware' },
      });
      expect(mockPrisma.problem.create).not.toHaveBeenCalled();
    });
  });

  describe('updateChange', () => {
    const changeTicket = { ...baseTicket, type: 'change', change: { id: 'change-1' } };

    it('rejects non-change tickets with 409', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicket);

      await expect(ticketService.updateChange('ticket-1', { cabApproved: true }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown cabApprovedBy user with 400', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(ticketService.updateChange('ticket-1', { cabApprovedBy: 'missing-user' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 400 });

      expect(mockPrisma.change.update).not.toHaveBeenCalled();
    });

    it('rejects an inactive cabApprovedBy user with 409', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: false });

      await expect(ticketService.updateChange('ticket-1', { cabApprovedBy: 'user-1' }, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.change.update).not.toHaveBeenCalled();
    });

    it('updates the change extension for an active approver reference', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true });

      await ticketService.updateChange('ticket-1', { cabApproved: true, cabApprovedBy: 'user-1', rollbackPlan: 'revert patch' }, 'actor-1');

      expect(mockPrisma.change.update).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1' },
        data: { cabApproved: true, cabApprovedBy: 'user-1', rollbackPlan: 'revert patch' },
      });
    });
  });

  describe('convertFromIncident', () => {
    const incident = {
      ...baseTicket,
      type: 'incident',
      status: 'new',
      assets: [{ id: 'link-1', assetId: 'asset-1' }],
    };

    it('rejects non-incident tickets with 409', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicket);

      await expect(ticketService.convertFromIncident('ticket-1', 'problem', undefined, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a disabled target ticket type', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(incident);
      mockPrisma.ticketTypeConfig.findUnique.mockResolvedValue({ type: 'problem', enabled: false });

      await expect(ticketService.convertFromIncident('ticket-1', 'problem', undefined, 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      mockPrisma.ticketTypeConfig.findUnique.mockResolvedValue(null);
    });

    it('creates a problem ticket pre-linked to the incident and records a caused_by_problem link', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(incident);
      mockPrisma.ticketTypeConfig.findUnique.mockResolvedValue(null);
      mockPrisma.ticket.create.mockResolvedValue({ id: 'ticket-new', displayId: 'TCKT-0100' });

      await ticketService.convertFromIncident('ticket-1', 'problem', undefined, 'actor-1');

      const createCall = mockPrisma.ticket.create.mock.calls[0][0];
      expect(createCall.data).toEqual(expect.objectContaining({
        type: 'problem',
        status: 'new',
        title: 'Printer outage investigation',
        priority: 'medium',
        assets: { create: [{ assetId: 'asset-1' }] },
        problem: { create: { relatedIncidentIds: ['ticket-1'] } },
      }));
      expect(mockPrisma.ticketLink.create).toHaveBeenCalledWith({
        data: { fromTicketId: 'ticket-1', toTicketId: 'ticket-new', linkType: 'caused_by_problem' },
      });
      expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ticketId: 'ticket-1', action: 'CONVERT' }),
      });
    });

    it('creates a change ticket with a resolved_by_change link when an override title is given', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(incident);
      mockPrisma.ticketTypeConfig.findUnique.mockResolvedValue(null);
      mockPrisma.ticket.create.mockResolvedValue({ id: 'ticket-new', displayId: 'TCKT-0100' });

      await ticketService.convertFromIncident('ticket-1', 'change', ' Replace printer fleet ', 'actor-1');

      const createCall = mockPrisma.ticket.create.mock.calls[0][0];
      expect(createCall.data).toEqual(expect.objectContaining({
        type: 'change',
        title: 'Replace printer fleet',
        change: { create: {} },
      }));
      expect(mockPrisma.ticketLink.create).toHaveBeenCalledWith({
        data: { fromTicketId: 'ticket-1', toTicketId: 'ticket-new', linkType: 'resolved_by_change' },
      });
    });
  });

  describe('linkRisk / unlinkRisk', () => {
    const changeTicket = { ...baseTicket, type: 'change', change: { id: 'change-1' } };

    it('rejects non-change tickets with 409', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicket);

      await expect(ticketService.linkRisk('ticket-1', 'risk-1', 'actor-1'))
        .rejects.toMatchObject({ statusCode: 409 });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown or archived risk', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);
      mockPrisma.risk.findUnique.mockResolvedValue(null);

      await expect(ticketService.linkRisk('ticket-1', 'risk-1', 'actor-1'))
        .rejects.toMatchObject({ statusCode: 404 });

      mockPrisma.risk.findUnique.mockResolvedValue({ id: 'risk-1', displayId: 'RSK-0001', isArchived: true });
      await expect(ticketService.linkRisk('ticket-1', 'risk-1', 'actor-1'))
        .rejects.toMatchObject({ statusCode: 404 });

      expect(mockPrisma.changeRiskLink.upsert).not.toHaveBeenCalled();
    });

    it('upserts the change-risk link idempotently', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);
      mockPrisma.risk.findUnique.mockResolvedValue({ id: 'risk-1', displayId: 'RSK-0001', isArchived: false });

      await ticketService.linkRisk('ticket-1', 'risk-1', 'actor-1');

      expect(mockPrisma.changeRiskLink.upsert).toHaveBeenCalledWith({
        where: { changeId_riskId: { changeId: 'change-1', riskId: 'risk-1' } },
        create: { changeId: 'change-1', riskId: 'risk-1' },
        update: {},
      });
      expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ticketId: 'ticket-1', action: 'LINK' }),
      });
    });

    it('removes the change-risk link on unlink', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(changeTicket);

      await ticketService.unlinkRisk('ticket-1', 'risk-1', 'actor-1');

      expect(mockPrisma.changeRiskLink.deleteMany).toHaveBeenCalledWith({
        where: { changeId: 'change-1', riskId: 'risk-1' },
      });
      expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ticketId: 'ticket-1', action: 'UNLINK' }),
      });
    });
  });
});
