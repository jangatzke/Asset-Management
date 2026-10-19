jest.mock('../config/database', () => {
  const prisma: any = {};
  for (const model of ['workflowTask', 'trainingAssignment', 'documentReview', 'correctiveAction', 'reviewTask', 'managementReviewAction', 'notificationDeadline', 'incidentAssessment', 'auditFinding', 'supplier', 'supplierAssessment', 'businessImpactAnalysis', 'businessContinuityPlan', 'bCPExercise', 'auditPlan', 'managementReview', 'ticket', 'nis2Registration']) {
    prisma[model] = { findMany: jest.fn().mockResolvedValue([]) };
  }
  return { prisma };
});
jest.mock('../services/authorization.service', () => ({
  authorizationService: { getActiveRoles: jest.fn().mockResolvedValue([]), buildReadFilter: jest.fn() },
}));

import { prisma } from '../config/database';
import { authorizationService } from '../services/authorization.service';
import { ActionCenterService } from '../services/actionCenter.service';

const mockPrisma = prisma as any;

describe('ActionCenterService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes an assigned open task and classifies it as critical', async () => {
    mockPrisma.workflowTask.findMany.mockResolvedValue([{ id: 'task-1', title: 'Approve', status: 'open', assigneeId: 'user-1', dueDate: new Date('2026-01-03T00:00:00Z') }]);
    const result = await new ActionCenterService().list('user-1', { scope: 'mine' }, new Date('2026-01-01T00:00:00Z'));
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ sourceType: 'workflowTask', dueDate: '2026-01-03T00:00:00.000Z', urgency: 'critical', assignment: 'mine' })]));
  });

  it('derives a new NIS2 approval due date from creation rather than its updated timestamp', async () => {
    mockPrisma.incidentAssessment.findMany.mockResolvedValue([{
      id: 'assessment-1', incidentId: 'incident-1', status: 'pending_approval',
      createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:01Z'),
      incident: { title: 'Outage' },
    }]);
    const result = await new ActionCenterService().list('approver-1', { scope: 'mine' }, new Date('2026-01-01T00:00:00Z'));
    expect(mockPrisma.incidentAssessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ decisionApprovalAssigneeId: 'approver-1', status: 'pending_approval' }) }));
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceType: 'incidentNonReportableApproval', dueDate: '2026-01-02T00:00:00.000Z', urgency: 'critical', assignment: 'mine', href: '/incidents/incident-1',
    })]));
    expect(result.summary.overdue).toBe(0);
    expect(result.summary.critical).toBeGreaterThan(0);
  });

  it('does not query authorized Phase 6 sources for scoped roles', async () => {
    (authorizationService.getActiveRoles as jest.Mock).mockResolvedValue([{ permissions: new Set(['audits.read']), scopeId: 'scope-1', legalEntityId: null, organizationUnitId: null, siteId: null }]);
    await new ActionCenterService().list('user-1', { scope: 'authorized' });
    expect(mockPrisma.auditFinding.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditPlan.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.managementReview.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.nis2Registration.findMany).not.toHaveBeenCalled();
  });

  it('surfaces NIS2 registration reviews derived from lastReviewDate for controls.read roles', async () => {
    (authorizationService.getActiveRoles as jest.Mock).mockResolvedValue([{ permissions: new Set(['controls.read']), legalEntityId: null, organizationUnitId: null, scopeId: null, siteId: null }]);
    mockPrisma.nis2Registration.findMany.mockResolvedValue([
      { id: 'reg-1', entityType: 'essential', status: 'pending', isArchived: false, lastReviewDate: new Date('2024-12-01T00:00:00Z'), deadline: null },
      { id: 'reg-2', entityType: 'important', status: 'submitted', isArchived: false, lastReviewDate: null, deadline: new Date('2026-01-05T00:00:00Z') },
      { id: 'reg-3', entityType: 'essential', status: 'pending', isArchived: false, lastReviewDate: null, deadline: null },
    ]);
    const result = await new ActionCenterService().list('user-1', { scope: 'authorized' }, new Date('2026-01-01T00:00:00Z'));
    expect(mockPrisma.nis2Registration.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isArchived: false }) }));
    const registrations = result.data.filter((entry) => entry.sourceType === 'nis2Registration');
    // reg-1 review due one year after its last review (overdue); reg-2 falls back to the registration deadline; reg-3 has no derivable date.
    expect(registrations).toHaveLength(2);
    expect(registrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'reg-1', dueDate: '2025-12-01T00:00:00.000Z', urgency: 'overdue', href: '/nis2' }),
      expect.objectContaining({ id: 'reg-2', dueDate: '2026-01-05T00:00:00.000Z', urgency: 'upcoming', href: '/nis2' }),
    ]));
  });

  it('includes an assigned open ticket with its SLA due date and links to the ticket', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([
      { id: 'ticket-1', displayId: 'TCKT-0001', title: 'VPN outage', status: 'in_progress', assigneeId: 'user-1', resolutionDueAt: null, slaTargetAt: new Date('2026-01-02T00:00:00Z'), firstResponseDueAt: new Date('2026-01-01T06:00:00Z') },
      { id: 'ticket-2', displayId: 'TCKT-0002', title: 'Done already', status: 'resolved', assigneeId: 'user-1', resolutionDueAt: new Date('2026-01-02T00:00:00Z') },
      { id: 'ticket-3', displayId: 'TCKT-0003', title: 'No SLA', status: 'new', assigneeId: 'user-1' },
    ]);
    const result = await new ActionCenterService().list('user-1', { scope: 'mine' }, new Date('2026-01-01T00:00:00Z'));
    // Only the open ticket with an SLA date appears; resolved and SLA-less tickets are excluded.
    const tickets = result.data.filter((entry) => entry.sourceType === 'ticket');
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual(expect.objectContaining({
      id: 'ticket-1', title: 'TCKT-0001: VPN outage', dueDate: '2026-01-02T00:00:00.000Z', urgency: 'critical', assignment: 'mine', href: '/tickets/ticket-1',
    }));
  });

  it('exposes authorized tickets only for unscoped roles with tickets.read', async () => {
    (authorizationService.getActiveRoles as jest.Mock).mockResolvedValue([{ permissions: new Set(['tickets.read']), legalEntityId: null, organizationUnitId: null, scopeId: null, siteId: null }]);
    (authorizationService.buildReadFilter as jest.Mock).mockResolvedValue({});
    mockPrisma.ticket.findMany.mockResolvedValue([
      { id: 'ticket-9', displayId: 'TCKT-0009', title: 'Visible ticket', status: 'new', resolutionDueAt: new Date('2026-01-04T00:00:00Z') },
    ]);
    const result = await new ActionCenterService().list('user-1', { scope: 'authorized' }, new Date('2026-01-01T00:00:00Z'));
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceType: 'ticket', id: 'ticket-9', dueDate: '2026-01-04T00:00:00.000Z', assignment: 'authorized', href: '/tickets/ticket-9',
    })]));
  });

  it('paginates in stable due-date, source-type, and id order', async () => {
    mockPrisma.incidentAssessment.findMany.mockResolvedValue([]);
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.workflowTask.findMany.mockResolvedValue([
      { id: 'b', title: 'B', status: 'open', assigneeId: 'user-1', dueDate: new Date('2026-01-05T00:00:00Z') },
      { id: 'a', title: 'A', status: 'open', assigneeId: 'user-1', dueDate: new Date('2026-01-04T00:00:00Z') },
    ]);
    const result = await new ActionCenterService().list('user-1', { scope: 'mine', page: 1, limit: 1 }, new Date('2026-01-01T00:00:00Z'));
    expect(result.data[0].id).toBe('a');
    expect(result.pagination).toMatchObject({ total: 2, totalPages: 2 });
  });
});
