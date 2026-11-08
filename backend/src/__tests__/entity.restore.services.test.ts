/**
 * Improvement #5 — restore service semantics for tickets, risks, controls and
 * incidents.
 *
 * Coverage per module:
 * - 404 when the record is missing
 * - 409 when the record is already active (not archived)
 * - `isArchived: false` write and `{ success: true }` result
 * - audit entry with the matching *_RESTORE action and the optional reason
 * - history entry recorded as the reversal of the archive (UPDATE)
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEvent: jest.fn(async () => undefined),
    logEventStandalone: jest.fn(async () => undefined),
  },
}));

jest.mock('../services/displayId.service', () => ({
  nextDisplayId: jest.fn(async () => 'TCKT-0001'),
  displayIdService: {
    nextDisplayIdStandalone: jest.fn(async () => 'RSK-0001'),
  },
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    require: jest.fn(async () => undefined),
    requireAdminAccess: jest.fn(async () => undefined),
    requireForEntity: jest.fn(async () => undefined),
    requireEntityPermission: jest.fn(async () => undefined),
    buildReadFilter: jest.fn(async () => ({})),
    buildControlImplementationReadFilter: jest.fn(async () => ({})),
  },
}));

import { auditService } from '../services/audit.service';
import { ticketService } from '../services/ticket.service';
import { riskService } from '../services/risk.service';
import { controlService } from '../services/control.service';
import { incidentService } from '../services/incident.service';

const mockAudit = auditService.logEventStandalone as any;
const mockAuditTx = auditService.logEvent as any;
const mockEntityHistoryCreate = (mockPrisma as any).entityHistoryEntry.create;
const mockIncidentHistoryCreate = (mockPrisma as any).incidentHistoryEntry.create;
const mockTicketHistoryCreate = (mockPrisma as any).ticketHistoryEntry.create;

const UUID = '550e8400-e29b-41d4-a716-446655440021';

const archivedTicket = { id: UUID, displayId: 'TCKT-0001', isArchived: true };
const activeTicket = { id: UUID, displayId: 'TCKT-0001', isArchived: false };
const archivedRisk = { id: UUID, title: 'Supplier breach risk', isArchived: true };
const activeRisk = { id: UUID, title: 'Supplier breach risk', isArchived: false };
const archivedControl = { id: UUID, title: 'Access control policy', isArchived: true };
const activeControl = { id: UUID, title: 'Access control policy', isArchived: false };
const archivedIncident = { id: UUID, title: 'Phishing campaign', isArchived: true };
const activeIncident = { id: UUID, title: 'Phishing campaign', isArchived: false };

beforeEach(() => {
  mockAudit.mockReset();
  mockAudit.mockResolvedValue(undefined);
  mockAuditTx.mockReset();
  mockAuditTx.mockResolvedValue(undefined);

  for (const model of ['ticket', 'risk', 'control', 'incident'] as const) {
    (mockPrisma as any)[model].findUnique.mockReset();
    (mockPrisma as any)[model].update.mockReset();
    (mockPrisma as any)[model].update.mockResolvedValue({});
  }
  mockEntityHistoryCreate.mockReset();
  mockEntityHistoryCreate.mockResolvedValue({});
  mockIncidentHistoryCreate.mockReset();
  mockIncidentHistoryCreate.mockResolvedValue({});
  mockTicketHistoryCreate.mockReset();
  mockTicketHistoryCreate.mockResolvedValue({});

  // Ticket restore runs in a transaction and resolves the actor name.
  (mockPrisma as any).$transaction.mockReset();
  (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  (mockPrisma as any).user.findUnique.mockReset();
  (mockPrisma as any).user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Admin', email: 'ada@example.com' });
});

describe('ticketService.restore', () => {
  beforeEach(() => {
    (mockPrisma as any).ticket.findUnique.mockResolvedValue(archivedTicket);
  });

  it('clears isArchived, writes history + audit and returns success', async () => {
    const result = await ticketService.restore(UUID, 'admin-user', 'Undo bulk archive');

    expect(result).toEqual({ success: true });
    expect((mockPrisma as any).ticket.update).toHaveBeenCalledWith({
      where: { id: UUID },
      data: { isArchived: false, updatedBy: 'admin-user' },
    });
    expect(mockTicketHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: UUID,
        action: 'UPDATE',
        summary: 'Restored TCKT-0001: Undo bulk archive',
        actorId: 'admin-user',
        actorName: 'Ada Admin',
      }),
    });
    expect(mockAuditTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'admin-user', action: 'TICKET_RESTORE', entityId: UUID }),
    );
  });

  it('returns 404 when the ticket is missing', async () => {
    (mockPrisma as any).ticket.findUnique.mockResolvedValue(null);

    await expect(ticketService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Ticket not found',
    });
    expect((mockPrisma as any).ticket.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the ticket is already active', async () => {
    (mockPrisma as any).ticket.findUnique.mockResolvedValue(activeTicket);

    await expect(ticketService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ticket is not archived',
    });
    expect((mockPrisma as any).ticket.update).not.toHaveBeenCalled();
  });
});

describe('riskService.restore', () => {
  beforeEach(() => {
    (mockPrisma as any).risk.findUnique.mockResolvedValue(archivedRisk);
  });

  it('clears isArchived, writes audit + entity history and returns success', async () => {
    const result = await riskService.restore(UUID, 'admin-user', 'Undo bulk archive');

    expect(result).toEqual({ success: true });
    expect((mockPrisma as any).risk.update).toHaveBeenCalledWith({
      where: { id: UUID },
      data: { isArchived: false },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        userId: 'admin-user',
        action: 'RISK_RESTORE',
        entityType: 'Risk',
        entityId: UUID,
        details: 'Restored risk: Supplier breach risk: Undo bulk archive',
      }),
    );
    expect(mockEntityHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Risk',
        entityId: UUID,
        action: 'UPDATE',
        summary: 'Restored risk: Supplier breach risk: Undo bulk archive',
        actorId: 'admin-user',
      }),
    });
  });

  it('returns 404 when the risk is missing', async () => {
    (mockPrisma as any).risk.findUnique.mockResolvedValue(null);

    await expect(riskService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Risk not found',
    });
  });

  it('returns 409 when the risk is already active', async () => {
    (mockPrisma as any).risk.findUnique.mockResolvedValue(activeRisk);

    await expect(riskService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Risk is not archived',
    });
  });
});

describe('controlService.restore', () => {
  beforeEach(() => {
    (mockPrisma as any).control.findUnique.mockResolvedValue(archivedControl);
  });

  it('clears isArchived, writes audit + entity history and returns success', async () => {
    const result = await controlService.restore(UUID, 'admin-user');

    expect(result).toEqual({ success: true });
    expect((mockPrisma as any).control.update).toHaveBeenCalledWith({
      where: { id: UUID },
      data: { isArchived: false },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ userId: 'admin-user', action: 'CONTROL_RESTORE', entityType: 'Control' }),
    );
    expect(mockEntityHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Control',
        entityId: UUID,
        action: 'UPDATE',
        summary: 'Restored control: Access control policy',
      }),
    });
  });

  it('returns 404 when the control is missing', async () => {
    (mockPrisma as any).control.findUnique.mockResolvedValue(null);

    await expect(controlService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Control not found',
    });
  });

  it('returns 409 when the control is already active', async () => {
    (mockPrisma as any).control.findUnique.mockResolvedValue(activeControl);

    await expect(controlService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Control is not archived',
    });
  });
});

describe('incidentService.restore', () => {
  beforeEach(() => {
    (mockPrisma as any).incident.findUnique.mockResolvedValue(archivedIncident);
  });

  it('clears isArchived, writes incident history + audit and returns success', async () => {
    const result = await incidentService.restore(UUID, 'admin-user', 'Undo bulk archive');

    expect(result).toEqual({ success: true });
    expect((mockPrisma as any).incident.update).toHaveBeenCalledWith({
      where: { id: UUID },
      data: { isArchived: false },
    });
    expect(mockIncidentHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: UUID,
        action: 'UPDATE',
        summary: 'Restored incident: Phishing campaign: Undo bulk archive',
        actorId: 'admin-user',
      }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ userId: 'admin-user', action: 'INCIDENT_RESTORE', entityType: 'Incident' }),
    );
  });

  it('returns 404 when the incident is missing', async () => {
    (mockPrisma as any).incident.findUnique.mockResolvedValue(null);

    await expect(incidentService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Incident not found',
    });
  });

  it('returns 409 when the incident is already active', async () => {
    (mockPrisma as any).incident.findUnique.mockResolvedValue(activeIncident);

    await expect(incidentService.restore(UUID, 'admin-user')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Incident is not archived',
    });
  });
});
