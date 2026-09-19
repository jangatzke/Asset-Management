import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEvent: jest.fn().mockResolvedValue({}), logEventStandalone: jest.fn().mockResolvedValue({}) } }));

const { slaService } = require('../services/sla.service');

const configBase = {
  id: 'sla-config-1',
  enabled: true,
  intervalMinutes: 60,
  escalationDelayMinutes: 30,
  escalationLevels: [1],
  notifyAssignee: true,
  notifyManager: true,
  notifyEmail: false,
};

const breachedTicket = {
  id: 'ticket-1',
  displayId: 'TCKT-0001',
  type: 'incident',
  title: 'SLA breach test',
  status: 'new',
  priority: 'high',
  firstResponseAt: null,
  firstResponseDueAt: new Date('2026-01-01T00:00:00.000Z'),
  resolutionDueAt: new Date('2026-01-01T00:00:00.000Z'),
  assigneeId: 'assignee-1',
  managerId: 'manager-1',
  assignee: { id: 'assignee-1', email: null, firstName: 'A', lastName: 'Assignee' },
  manager: { id: 'manager-1', email: null, firstName: 'M', lastName: 'Manager' },
};

describe('SLA escalation breach scan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.slaConfig.findFirst.mockResolvedValue(null);
    mockPrisma.slaConfig.create.mockResolvedValue(configBase);
    mockPrisma.ticket.findMany.mockResolvedValue([breachedTicket]);
    mockPrisma.slaEscalationLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.slaEscalationLog.findFirst.mockResolvedValue(null);
    mockPrisma.ticketEscalation.create.mockResolvedValue({});
    mockPrisma.ticketHistoryEntry.create.mockResolvedValue({});
    mockPrisma.slaConfig.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  it('creates an escalation record and history entry for a first-response breach', async () => {
    const result = await slaService.scanBreach('system');

    expect(mockPrisma.ticketEscalation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ticketId: 'ticket-1', escalationType: 'sla_breach', reason: expect.stringContaining('firstResponse') }),
    }));
    expect(mockPrisma.slaEscalationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ticketId: 'ticket-1', breachType: 'firstResponse', level: 1 }),
    }));
    expect(mockPrisma.ticketHistoryEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ticketId: 'ticket-1', action: 'TICKET_ESCALATE' }),
    }));
    expect(result.escalated).toBe(2);
  });

  it('does not duplicate escalation records on a second scan (idempotent)', async () => {
    const createdLogs: any[] = [];
    mockPrisma.slaEscalationLog.create.mockImplementation(async (args: any) => {
      const record = { id: `log-${createdLogs.length + 1}`, ...args.data };
      createdLogs.push(record);
      return record;
    });
    mockPrisma.slaEscalationLog.findFirst.mockImplementation(async (args: any) => createdLogs.find((l) => l.ticketId === args.where.ticketId && l.breachType === args.where.breachType && l.level === args.where.level) ?? null);

    await slaService.scanBreach('system');
    await slaService.scanBreach('system');

    // Two breaches per scan, one level each => 2 records created on the first scan, none on the second.
    expect(mockPrisma.slaEscalationLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.slaEscalationLog.findFirst).toHaveBeenCalled();
  });

  it('escalates to the manager at level 2 while notifying the assignee at level 1', async () => {
    mockPrisma.slaConfig.create.mockResolvedValue({ ...configBase, escalationLevels: [1, 2] });

    await slaService.scanBreach('system');

    const escalationData = mockPrisma.ticketEscalation.create.mock.calls.map((call: any) => call[0].data);
    const levelOne = escalationData.find((d: any) => d.level === 1);
    const levelTwo = escalationData.find((d: any) => d.level === 2);

    expect(levelOne.escalatedTo).toBe('assignee-1');
    expect(levelTwo.escalatedTo).toBe('manager-1');
  });

  it('skips tickets that are not in breach (already responded, no resolution due)', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([
      { ...breachedTicket, firstResponseAt: new Date('2026-01-01T00:00:00.000Z'), resolutionDueAt: null },
    ]);

    const result = await slaService.scanBreach('system');

    expect(result.escalated).toBe(0);
    expect(mockPrisma.ticketEscalation.create).not.toHaveBeenCalled();
  });

  it('returns a sanitized config without the SMTP password', async () => {
    const config = await slaService.getConfig();
    expect(config.smtpPassword).toBeUndefined();
    expect(config.smtpPasswordConfigured).toBe(false);
  });
});
