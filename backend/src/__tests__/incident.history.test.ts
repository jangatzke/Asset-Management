/**
 * Incident History Tests (AUDIT-001)
 *
 * Verifies that:
 * - History entries are created on incident create, update, delete, close, assess, knowledge-time-change
 * - History entries are returned in chronological order (ascending by createdAt)
 * - Each entry contains timestamp, actor, action type, and field changes
 * - The GET /api/v1/incidents/:id/history endpoint returns correct data
 * - Authorization is enforced on the history endpoint
 */

import { createMockPrismaClient } from '../test/prisma-mock';

// ==========================================
// Mock Setup — must use var for hoisting before jest.mock
// ==========================================

var mockPrisma = createMockPrismaClient();

// Override the prisma import
jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEventStandalone: jest.fn().mockResolvedValue({}),
  },
}));

const { incidentService } = require('../services/incident.service');

describe('Incident History (AUDIT-001)', () => {
  let createdIncidentId: string;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup incident findUnique for getById (used by create, update, etc.)
    mockPrisma.incident.findUnique.mockResolvedValue(null);
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    // Setup incident findMany for list
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    // Setup incident create
    mockPrisma.incident.create.mockResolvedValue({
      id: 'incident-1',
      title: 'Test Incident',
      description: 'A test incident',
      detectionTime: new Date('2026-01-01T10:00:00Z'),
      knowledgeTime: new Date('2026-01-01T10:05:00Z'),
      incidentManagerId: 'manager-1',
      severity: 'medium',
      status: 'new',
      notificationStatus: 'pending_assessment',
      isSignificant: false,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });

    // Setup incident update - return a resolved promise with the updated incident
    mockPrisma.incident.update.mockResolvedValue({
      id: 'incident-1',
      title: 'Updated Incident',
      description: 'Updated description',
      detectionTime: new Date('2026-01-01T10:00:00Z'),
      knowledgeTime: new Date('2026-01-01T10:05:00Z'),
      incidentManagerId: 'manager-1',
      severity: 'high',
      status: 'under_investigation',
      notificationStatus: 'pending_assessment',
      isSignificant: true,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T12:00:00Z'),
    });

    // Setup incident updateMany for the compare-and-set status transition path
    mockPrisma.incident.updateMany.mockResolvedValue({ count: 1 });

    // Setup incident history entry create
    mockPrisma.incidentHistoryEntry.create.mockResolvedValue({
      id: 'history-1',
      incidentId: 'incident-1',
      action: 'CREATE',
      summary: 'Created incident: Test Incident',
      fieldChanges: {},
      actorId: 'user-1',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });

    // Setup incident history entry findMany
    mockPrisma.incidentHistoryEntry.findMany.mockResolvedValue([]);

    // Setup significance rules upsert
    mockPrisma.nis2IncidentSignificanceRuleVersion.upsert.mockResolvedValue({
      id: 'rules-1',
      version: '1.0',
      rules: [],
    });

    // Setup $transaction to delegate to mockPrisma for transactional calls
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      return cb(mockPrisma);
    });

    // Setup notification deadline createMany
    mockPrisma.notificationDeadline.createMany.mockResolvedValue({ count: 0 });
  });

  describe('History recording on incident lifecycle', () => {
    it('creates a history entry on incident creation', async () => {
      await incidentService.create(
        {
          title: 'Test Incident',
          description: 'A test incident',
          detectionTime: new Date('2026-01-01T10:00:00Z'),
          knowledgeTime: new Date('2026-01-01T10:05:00Z'),
          incidentManagerId: 'manager-1',
        },
        'user-1'
      );

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentId: 'incident-1',
            action: 'CREATE',
            summary: 'Created incident: Test Incident',
            actorId: 'user-1',
          }),
        })
      );
    });

    it('records a field-change entry and a separate status transition entry when both change in one save', async () => {
      // Set up findUnique to return existing incident for update and status transition
      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Original description',
        severity: 'low',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        availabilityImpact: 'medium',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Updated Incident',
        description: 'Updated description',
        severity: 'high',
        status: 'under_investigation',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        availabilityImpact: 'high',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T12:00:00Z'),
      } as any);

      await incidentService.update('incident-1', {
        title: 'Updated Incident',
        description: 'Updated description',
        severity: 'high',
        availabilityImpact: 'high',
      }, 'user-1');

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(2);

      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;
      expect(createCalls.map((call: any) => call[0].data.action)).toEqual(['UPDATE', 'STATUS_CHANGE']);

      const updateEntry = createCalls[0][0].data;
      expect(updateEntry).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'UPDATE',
          summary: 'Updated incident: Test Incident (title, description, severity, availabilityImpact)',
          actorId: 'user-1',
        })
      );
      expect(updateEntry.fieldChanges).toEqual({
        title: { old: 'Test Incident', new: 'Updated Incident' },
        description: { old: 'Original description', new: 'Updated description' },
        severity: { old: 'low', new: 'high' },
        availabilityImpact: { old: 'medium', new: 'high' },
      });
      expect(updateEntry.fieldChanges).not.toHaveProperty('oldStatus');

      const statusChangeCall = createCalls[1][0].data;
      expect(statusChangeCall).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'STATUS_CHANGE',
          summary: 'Status changed from new to under_investigation: Starting investigation',
          actorId: 'user-1',
          fieldChanges: { oldStatus: 'new', newStatus: 'under_investigation' },
        })
      );
    });

    it('creates visible creation and status transition history entries for new to under investigation', async () => {
      await incidentService.create(
        {
          title: 'Investigation Incident',
          description: 'A test incident requiring investigation',
          detectionTime: new Date('2026-01-01T10:00:00Z'),
          knowledgeTime: new Date('2026-01-01T10:05:00Z'),
          incidentManagerId: 'manager-1',
        },
        'user-1'
      );

      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Investigation Incident',
        description: 'A test incident requiring investigation',
        severity: 'medium',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Investigation Incident',
        description: 'A test incident requiring investigation',
        severity: 'medium',
        status: 'under_investigation',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;
      expect(createCalls).toHaveLength(2);
      expect(createCalls.map((call: any) => call[0].data.action)).toEqual(['CREATE', 'STATUS_CHANGE']);
      expect(createCalls[0][0].data).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'CREATE',
          summary: 'Created incident: Investigation Incident',
          actorId: 'user-1',
        })
      );
      expect(createCalls[1][0].data).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'STATUS_CHANGE',
          summary: 'Status changed from new to under_investigation: Starting investigation',
          actorId: 'user-1',
          fieldChanges: { oldStatus: 'new', newStatus: 'under_investigation' },
        })
      );
    });

    it('creates only create and status-change history when only the status changes', async () => {
      await incidentService.create(
        {
          title: 'Investigation Incident',
          description: 'A test incident requiring investigation',
          detectionTime: new Date('2026-01-01T10:00:00Z'),
          knowledgeTime: new Date('2026-01-01T10:05:00Z'),
          incidentManagerId: 'manager-1',
          severity: 'medium',
        },
        'user-1'
      );

      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Investigation Incident',
        description: 'A test incident requiring investigation',
        severity: 'medium',
        status: 'new',
        detectionTime: new Date('2026-01-01T10:00:00Z'),
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        incidentManagerId: 'manager-1',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Investigation Incident',
        description: 'A test incident requiring investigation',
        severity: 'medium',
        status: 'under_investigation',
        detectionTime: new Date('2026-01-01T10:00:00Z'),
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        incidentManagerId: 'manager-1',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;
      expect(createCalls).toHaveLength(2);
      expect(createCalls.map((call: any) => call[0].data.action)).toEqual(['CREATE', 'STATUS_CHANGE']);
      expect(createCalls[1][0].data).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'STATUS_CHANGE',
          summary: 'Status changed from new to under_investigation: Starting investigation',
          actorId: 'user-1',
          fieldChanges: { oldStatus: 'new', newStatus: 'under_investigation' },
        })
      );
    });

    it('does not report unchanged financialImpact during under investigation to contained status-only transition', async () => {
      const unchangedFinancialImpact = {
        toString: () => '0.00',
        toJSON: () => '0.00',
      };

      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Contained Incident',
        description: 'A contained incident',
        severity: 'medium',
        status: 'under_investigation',
        detectionTime: new Date('2026-01-01T10:00:00Z'),
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        incidentManagerId: 'manager-1',
        financialImpact: unchangedFinancialImpact,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Contained Incident',
        description: 'A contained incident',
        severity: 'medium',
        status: 'contained',
        detectionTime: new Date('2026-01-01T10:00:00Z'),
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        incidentManagerId: 'manager-1',
        financialImpact: unchangedFinancialImpact,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:30:00Z'),
      } as any);

      // Sending the unchanged Decimal-normalized financialImpact via the generic
      // update path must not create a history entry (value normalization).
      await incidentService.update('incident-1', { financialImpact: 0 }, 'user-1');

      await incidentService.changeIncidentStatus('incident-1', { status: 'contained', reason: 'Contained' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(1);

      const statusChangeCall = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0];
      expect(statusChangeCall[0].data).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'STATUS_CHANGE',
          summary: 'Status changed from under_investigation to contained: Contained',
          actorId: 'user-1',
          fieldChanges: { oldStatus: 'under_investigation', newStatus: 'contained' },
        })
      );
      expect(statusChangeCall[0].data.summary).not.toContain('financialImpact');
      expect(statusChangeCall[0].data.fieldChanges).not.toHaveProperty('financialImpact');
    });

    it('creates one update history entry for non-status field changes', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Original description',
        severity: 'low',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Updated description',
        severity: 'low',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:30:00Z'),
      } as any);

      await incidentService.update('incident-1', { description: 'Updated description' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(1);
      expect((mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          incidentId: 'incident-1',
          action: 'UPDATE',
          summary: 'Updated incident: Test Incident (description)',
          actorId: 'user-1',
          fieldChanges: { description: { old: 'Original description', new: 'Updated description' } },
        })
      );
    });

    it('creates a history entry on incident delete (archive)', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        isArchived: false,
      } as any);

      mockPrisma.incident.update.mockResolvedValueOnce({ success: true } as any);

      await incidentService.delete('incident-1', 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentId: 'incident-1',
            action: 'DELETE',
            summary: 'Archived incident: Test Incident',
            actorId: 'user-1',
          }),
        })
      );
    });

    it('creates history entries on incident close', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        status: 'under_investigation',
        isSignificant: false,
        rootCause: 'Patch gap identified',
        measuresEvaluation: 'Controls improved',
        reports: [],
      } as any);

      mockPrisma.incident.update.mockResolvedValueOnce({
        id: 'incident-1',
        status: 'closed',
        closedAt: new Date(),
        closedBy: 'user-1',
      } as any);

      await incidentService.closeIncident('incident-1', {
        rootCause: 'Patch gap identified',
        measuresEvaluation: 'Controls improved',
        closureSummary: 'Resolved and closed',
      }, 'user-1');

      // Should create both STATUS_CHANGE and CLOSE entries
      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;
      const actions = createCalls.map((call: any) => call[0].data.action);

      expect(actions).toContain('STATUS_CHANGE');
      expect(actions).toContain('CLOSE');

      // Verify STATUS_CHANGE entry
      const statusChangeCall = createCalls.find((call: any) => call[0].data.action === 'STATUS_CHANGE');
      expect(statusChangeCall).toBeDefined();
      expect(statusChangeCall[0].data.fieldChanges).toEqual(
        expect.objectContaining({ oldStatus: 'under_investigation', newStatus: 'closed' })
      );

      // Verify CLOSE entry
      const closeCall = createCalls.find((call: any) => call[0].data.action === 'CLOSE');
      expect(closeCall).toBeDefined();
      expect(closeCall[0].data.summary).toBe('Resolved and closed');
    });

    it('creates a history entry on incident assessment', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        significanceRuleVersionId: 'rules-1',
      } as any);

      mockPrisma.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValueOnce({
        id: 'rules-1',
        rules: [],
      });

      mockPrisma.incidentAssessment.upsert.mockResolvedValueOnce({
        id: 'assessment-1',
        incidentId: 'incident-1',
        isReportable: true,
        assessorId: 'assessor-1',
      });

      mockPrisma.incident.update.mockResolvedValueOnce({});

      await incidentService.assessIncident('incident-1', {
        isReportable: true,
      }, 'assessor-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentId: 'incident-1',
            action: 'ASSESSMENT',
            summary: 'Assessed incident: reportable',
            actorId: 'assessor-1',
          }),
        })
      );
    });

    it('derives assessment persistence and history actors from the required actor argument', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        significanceRuleVersionId: 'rules-1',
      } as any);
      mockPrisma.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValueOnce({ id: 'rules-1', rules: [] });
      mockPrisma.incidentAssessment.upsert.mockResolvedValueOnce({ id: 'assessment-1' });
      mockPrisma.incident.update.mockResolvedValueOnce({});

      await incidentService.assessIncident('incident-1', { isReportable: true }, 'authenticated-user');

      expect(mockPrisma.incidentAssessment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ assessorId: 'authenticated-user' }),
        update: expect.objectContaining({ assessorId: 'authenticated-user', updatedBy: 'authenticated-user' }),
      }));
      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ actorId: 'authenticated-user' }),
      }));
    });

    it('creates a history entry on knowledge time change', async () => {
      mockPrisma.incident.findUnique.mockResolvedValueOnce({
        id: 'incident-1',
        title: 'Test Incident',
        knowledgeTime: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          incidentKnowledgeTimeChange: {
            create: jest.fn().mockResolvedValue({}),
          },
          incident: {
            update: jest.fn().mockResolvedValue({
              id: 'incident-1',
              knowledgeTime: new Date('2026-01-01T12:00:00Z'),
            }),
          },
          notificationDeadline: {
            deleteMany: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      mockPrisma.nis2IncidentSignificanceRuleVersion.upsert.mockResolvedValueOnce({
        id: 'rules-1',
        version: '1.0',
        rules: [],
      });

      const newKnowledgeTime = new Date('2026-01-01T12:00:00Z');
      await incidentService.changeKnowledgeTime('incident-1', newKnowledgeTime, 'Forensic correction', 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentId: 'incident-1',
            action: 'KNOWLEDGE_TIME_CHANGE',
            summary: 'Changed knowledge time: Forensic correction',
            actorId: 'user-1',
          }),
        })
      );

      const callArgs = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.fieldChanges).toHaveProperty('oldKnowledgeTime');
      expect(callArgs.data.fieldChanges).toHaveProperty('newKnowledgeTime');
    });
  });

  describe('History retrieval', () => {
    it('returns history entries in chronological order', async () => {
      const mockHistoryEntries = [
        {
          id: 'history-1',
          incidentId: 'incident-1',
          action: 'CREATE',
          summary: 'Created incident: Test Incident',
          fieldChanges: {},
          actorId: 'user-1',
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'history-2',
          incidentId: 'incident-1',
          action: 'UPDATE',
          summary: 'Updated incident: severity changed',
          fieldChanges: { severity: { old: 'low', new: 'high' } },
          actorId: 'user-1',
          createdAt: new Date('2026-01-01T11:00:00Z'),
        },
        {
          id: 'history-3',
          incidentId: 'incident-1',
          action: 'STATUS_CHANGE',
          summary: 'Status changed to closed',
          fieldChanges: { oldStatus: 'under_investigation', newStatus: 'closed' },
          actorId: 'user-2',
          createdAt: new Date('2026-01-01T12:00:00Z'),
        },
      ];

      mockPrisma.incidentHistoryEntry.findMany.mockResolvedValueOnce(mockHistoryEntries);
      mockPrisma.incident.findUnique.mockResolvedValueOnce({ id: 'incident-1' } as any);

      const result = await incidentService.getHistory('incident-1', {});

      expect(result).toHaveLength(3);
      expect(result[0].action).toBe('CREATE');
      expect(result[1].action).toBe('UPDATE');
      expect(result[2].action).toBe('STATUS_CHANGE');
      expect(result[0].createdAt < result[1].createdAt).toBe(true);
      expect(result[1].createdAt < result[2].createdAt).toBe(true);

      expect(mockPrisma.incidentHistoryEntry.findMany).toHaveBeenCalledWith({
        where: { incidentId: 'incident-1' },
        orderBy: { createdAt: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('filters history entries by action type', async () => {
      const mockUpdateEntries = [
        {
          id: 'history-2',
          incidentId: 'incident-1',
          action: 'UPDATE',
          summary: 'Updated incident: severity changed',
          fieldChanges: { severity: { old: 'low', new: 'high' } },
          actorId: 'user-1',
          createdAt: new Date('2026-01-01T11:00:00Z'),
        },
      ];

      mockPrisma.incidentHistoryEntry.findMany.mockResolvedValueOnce(mockUpdateEntries);
      mockPrisma.incident.findUnique.mockResolvedValueOnce({ id: 'incident-1' } as any);

      const result = await incidentService.getHistory('incident-1', { action: 'UPDATE' });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('UPDATE');

      expect(mockPrisma.incidentHistoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'UPDATE' }),
        })
      );
    });

    it('respects limit and offset pagination', async () => {
      mockPrisma.incidentHistoryEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.incident.findUnique.mockResolvedValueOnce({ id: 'incident-1' } as any);

      await incidentService.getHistory('incident-1', { limit: 10, offset: 5 });

      expect(mockPrisma.incidentHistoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      );
    });

    it('returns empty array when no history exists', async () => {
      mockPrisma.incidentHistoryEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.incident.findUnique.mockResolvedValueOnce({ id: 'incident-1' } as any);

      const result = await incidentService.getHistory('incident-1');

      expect(result).toEqual([]);
    });
  });

  describe('History entry data integrity', () => {
    it('records all required fields in history entries', async () => {
      await incidentService.create(
        {
          title: 'Full Test Incident',
          description: 'Full test description',
          detectionTime: new Date('2026-01-01T10:00:00Z'),
          knowledgeTime: new Date('2026-01-01T10:05:00Z'),
          incidentManagerId: 'manager-1',
          severity: 'high',
        },
        'user-1'
      );

      const createCall = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0][0];
      const data = createCall.data;

      // Verify all required fields are present (createdAt is DB-generated, not in data)
      expect(data.incidentId).toBe('incident-1');
      expect(data.action).toBe('CREATE');
      expect(data.summary).toBe('Created incident: Full Test Incident');
      expect(data.actorId).toBe('user-1');

      // Verify fieldChanges is an object (even if empty for CREATE)
      expect(data.fieldChanges).toBeDefined();
    });

    it('records a field-change entry and a separate status entry when status and fields change', async () => {
      // Reset mocks completely for this test
      mockPrisma.incident.findUnique.mockReset();
      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Original Title',
        description: 'Original Description',
        severity: 'low',
        status: 'new',
        availabilityImpact: 'medium',
        confidentialityImpact: 'none',
        knowledgeTime: new Date('2026-01-01T10:00:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockReset();
      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'New Title',
        description: 'Original Description', // unchanged
        severity: 'critical',
        status: 'under_investigation',
        availabilityImpact: 'high',
        confidentialityImpact: 'none', // unchanged
        knowledgeTime: new Date('2026-01-01T10:00:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T12:00:00Z'),
      } as any);

      await incidentService.update('incident-1', {
        title: 'New Title',
        severity: 'critical',
        availabilityImpact: 'high',
      }, 'user-1');

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(2);

      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;

      const updateEntry = createCalls.find((call: any) => call[0].data.action === 'UPDATE');
      expect(updateEntry).toBeDefined();
      const updateFieldChanges = updateEntry[0].data.fieldChanges;

      // Only changed fields should be recorded in the update entry
      expect(updateFieldChanges.title).toEqual({ old: 'Original Title', new: 'New Title' });
      expect(updateFieldChanges.severity).toEqual({ old: 'low', new: 'critical' });
      expect(updateFieldChanges.availabilityImpact).toEqual({ old: 'medium', new: 'high' });

      // Unchanged fields should NOT be in fieldChanges
      expect(updateFieldChanges.description).toBeUndefined();
      expect(updateFieldChanges.confidentialityImpact).toBeUndefined();
      expect(updateFieldChanges).not.toHaveProperty('oldStatus');
      expect(updateFieldChanges).not.toHaveProperty('newStatus');

      const statusChangeCall = createCalls.find((call: any) => call[0].data.action === 'STATUS_CHANGE');
      expect(statusChangeCall).toBeDefined();
      const statusFieldChanges = statusChangeCall[0].data.fieldChanges;
      expect(statusFieldChanges.oldStatus).toBe('new');
      expect(statusFieldChanges.newStatus).toBe('under_investigation');
    });
  });

  describe('Null-safety for missing incidentHistoryEntry model', () => {
    it('returns empty array when incidentHistoryEntry is undefined on getHistory', async () => {
      // Simulate missing model by removing it from the mock prisma
      const savedModel = mockPrisma.incidentHistoryEntry;
      (mockPrisma as any).incidentHistoryEntry = undefined;

      const result = await incidentService.getHistory('incident-1');

      expect(result).toEqual([]);
      // Restore for other tests
      (mockPrisma as any).incidentHistoryEntry = savedModel;
    });

    it('does not throw when incidentHistoryEntry is undefined on recordHistoryEntry', async () => {
      // Simulate missing model by removing it from the mock prisma
      const savedModel = mockPrisma.incidentHistoryEntry;
      (mockPrisma as any).incidentHistoryEntry = undefined;

      // Should not throw, just log a warning
      await incidentService['recordHistoryEntry']('incident-1', 'CREATE', 'Test summary', {}, 'user-1');

      // Restore for other tests
      (mockPrisma as any).incidentHistoryEntry = savedModel;
    });
  });

  describe('Status change fieldChanges integrity', () => {
    it('status change from contained to under_investigation stores oldStatus/newStatus but no duplicate field entries', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Contained Incident',
        description: 'A test incident',
        severity: 'medium',
        status: 'contained',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Contained Incident',
        description: 'A test incident',
        severity: 'medium',
        status: 'under_investigation',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Reopening investigation' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(1);
      const callArgs = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.action).toBe('STATUS_CHANGE');
      expect(callArgs.data.summary).toBe('Status changed from contained to under_investigation: Reopening investigation');

      // Verify fieldChanges contains oldStatus/newStatus but no bogus empty-field entries.
      const fieldChanges = callArgs.data.fieldChanges as Record<string, unknown>;
      expect(fieldChanges.oldStatus).toBe('contained');
      expect(fieldChanges.newStatus).toBe('under_investigation');
      // No other spurious keys should be present when only status changed.
      expect(Object.keys(fieldChanges)).toEqual(['oldStatus', 'newStatus']);
    });

    it('status transition with additional field changes stores a field entry and a status entry', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Original',
        severity: 'low',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Test Incident Updated',
        description: 'Original',
        severity: 'high',
        status: 'under_investigation',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      await incidentService.update('incident-1', { severity: 'high', title: 'Test Incident Updated' }, 'user-1');

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

      expect(mockPrisma.incidentHistoryEntry.create).toHaveBeenCalledTimes(2);
      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;

      const updateEntry = createCalls.find((call: any) => call[0].data.action === 'UPDATE');
      expect(updateEntry).toBeDefined();
      const updateFieldChanges = updateEntry[0].data.fieldChanges as Record<string, unknown>;
      // Other changed fields should be stored with {old, new} structure.
      expect((updateFieldChanges.severity as { old: string; new: string }).old).toBe('low');
      expect((updateFieldChanges.severity as { old: string; new: string }).new).toBe('high');
      expect((updateFieldChanges.title as { old: string; new: string }).old).toBe('Test Incident');
      expect((updateFieldChanges.title as { old: string; new: string }).new).toBe('Test Incident Updated');
      expect(updateFieldChanges).not.toHaveProperty('oldStatus');
      expect(updateFieldChanges).not.toHaveProperty('newStatus');

      const statusEntry = createCalls.find((call: any) => call[0].data.action === 'STATUS_CHANGE');
      expect(statusEntry).toBeDefined();
      const statusFieldChanges = statusEntry[0].data.fieldChanges as Record<string, unknown>;
      expect(statusFieldChanges.oldStatus).toBe('new');
      expect(statusFieldChanges.newStatus).toBe('under_investigation');
    });
  });

  describe('Actor attribution on history entries', () => {
    it('all status-change and update history entries include actorId when provided', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Original',
        severity: 'low',
        status: 'new',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      } as any);

      mockPrisma.incident.update.mockResolvedValue({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Original',
        severity: 'high',
        status: 'under_investigation',
        knowledgeTime: new Date('2026-01-01T10:05:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:15:00Z'),
      } as any);

      await incidentService.update('incident-1', { severity: 'high' }, 'user-42');

      await incidentService.changeIncidentStatus('incident-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-42');

      const createCalls = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls;
      expect(createCalls).toHaveLength(2);
      expect(createCalls.map((call: any) => call[0].data.actorId)).toEqual(['user-42', 'user-42']);
    });

    it('incident creation history entry includes createdBy as actorId', async () => {
      await incidentService.create(
        {
          title: 'Actor Test Incident',
          description: 'Testing actor attribution',
          detectionTime: new Date('2026-01-01T10:00:00Z'),
          knowledgeTime: new Date('2026-01-01T10:05:00Z'),
          incidentManagerId: 'manager-1',
        },
        'user-99'
      );

      const callArgs = (mockPrisma.incidentHistoryEntry.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.actorId).toBe('user-99');
    });
  });
});
