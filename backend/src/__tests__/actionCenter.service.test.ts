jest.mock('../config/database', () => {
  const prisma: any = {};
  for (const model of ['workflowTask', 'trainingAssignment', 'documentReview', 'correctiveAction', 'reviewTask', 'managementReviewAction', 'notificationDeadline', 'incidentAssessment', 'auditFinding', 'supplier', 'supplierAssessment', 'businessImpactAnalysis', 'businessContinuityPlan', 'bCPExercise', 'auditPlan', 'managementReview']) {
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
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ sourceType: 'workflowTask', urgency: 'critical', assignment: 'mine' })]));
  });

  it('shows pending non-reportable approval only to its assigned approver', async () => {
    mockPrisma.incidentAssessment.findMany.mockResolvedValue([{ id: 'assessment-1', incidentId: 'incident-1', status: 'pending_approval', updatedAt: new Date('2026-01-03T00:00:00Z'), incident: { title: 'Outage' } }]);
    const result = await new ActionCenterService().list('approver-1', { scope: 'mine' }, new Date('2026-01-01T00:00:00Z'));
    expect(mockPrisma.incidentAssessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ decisionApprovalAssigneeId: 'approver-1', status: 'pending_approval' }) }));
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ sourceType: 'incidentNonReportableApproval', assignment: 'mine', href: '/incidents/incident-1' })]));
  });

  it('does not query authorized Phase 6 sources for scoped roles', async () => {
    (authorizationService.getActiveRoles as jest.Mock).mockResolvedValue([{ permissions: new Set(['audits.read']), scopeId: 'scope-1', legalEntityId: null, organizationUnitId: null, siteId: null }]);
    await new ActionCenterService().list('user-1', { scope: 'authorized' });
    expect(mockPrisma.auditFinding.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditPlan.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.managementReview.findMany).not.toHaveBeenCalled();
  });

  it('paginates in stable due-date, source-type, and id order', async () => {
    mockPrisma.incidentAssessment.findMany.mockResolvedValue([]);
    mockPrisma.workflowTask.findMany.mockResolvedValue([
      { id: 'b', title: 'B', status: 'open', assigneeId: 'user-1', dueDate: new Date('2026-01-05T00:00:00Z') },
      { id: 'a', title: 'A', status: 'open', assigneeId: 'user-1', dueDate: new Date('2026-01-04T00:00:00Z') },
    ]);
    const result = await new ActionCenterService().list('user-1', { scope: 'mine', page: 1, limit: 1 }, new Date('2026-01-01T00:00:00Z'));
    expect(result.data[0].id).toBe('a');
    expect(result.pagination).toMatchObject({ total: 2, totalPages: 2 });
  });
});
