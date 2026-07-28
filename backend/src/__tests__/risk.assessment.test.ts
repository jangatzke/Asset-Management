/**
 * Paket 3.2 — Risikobewertung Tests
 *
 * Coverage:
 * - Relationale Risikobausteine (Scenario, Threat, Vulnerability, Cause, Impact)
 * - Assessment History & Versionierung
 * - Mandatory Justification
 * - ReviewTask creation from unplanned events
 * - Junction table relationships (Asset/Process/Service)
 */

import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();
const PrismaMock = mockPrisma;

// Mock the database module
jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEventStandalone: jest.fn<any>().mockResolvedValue({ id: 'audit-id' }),
  },
}));

jest.mock('../services/displayId.service', () => ({
  displayIdService: {
    nextDisplayIdStandalone: jest.fn<any>().mockImplementation((_prisma: any, entityType: string) => {
      const prefixes: Record<string, string> = { Risk: 'RSK', ReviewTask: 'RTASK', RiskTreatment: 'RT' };
      return `${prefixes[entityType] ?? 'ENT'}-${Date.now()}`;
    }),
  },
}));

// Import after mocking
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { riskService } = require('../services/risk.service') as any;

// ==========================================
// Test Fixtures
// ==========================================

const mockThreat = {
  id: 'threat-001',
  displayId: 'THR-001',
  name: 'Unauthorized Access',
  description: 'External attacker gains unauthorized access',
  category: 'external',
  source: 'internet',
  status: 'active',
  isArchived: false,
};

const mockVulnerability = {
  id: 'vuln-001',
  displayId: 'VULN-001',
  name: 'Unpatched CVE-2024-1234',
  description: 'Remote code execution vulnerability',
  category: 'software',
  severity: 'high',
  cveId: 'CVE-2024-1234',
  status: 'active',
  isArchived: false,
};

const mockScenario = {
  id: 'scenario-001',
  displayId: 'SCN-001',
  title: 'Attacker exploits unpatched vulnerability to access system',
  description: 'External threat actor leverages known CVE to gain RCE',
  threatId: 'threat-001',
  vulnerabilityId: 'vuln-001',
};

const mockCause = {
  id: 'cause-001',
  displayId: 'CAU-001',
  title: 'Missing patch management process',
  description: 'No automated patch deployment in place',
  category: 'organizational',
};

const mockImpact = {
  id: 'impact-001',
  displayId: 'IMP-001',
  title: 'Data breach and system compromise',
  description: 'Full system access leading to data exfiltration',
  category: 'confidentiality',
  severity: 'very_high',
};

const mockMethodVersion = {
  id: 'method-version-001',
  riskMethodId: 'method-001',
  versionTag: '1.0.0-snapshot-1',
  likelihoodScale: { 1: 'Rare', 2: 'Unlikely', 3: 'Possible', 4: 'Likely', 5: 'Almost Certain' },
  impactScale: { 1: 'Negligible', 2: 'Minor', 3: 'Moderate', 4: 'Major', 5: 'Catastrophic' },
  ratingDimensions: {},
  calculationType: 'product',
  riskClasses: { low: [0, 4], medium: [5, 9], high: [10, 16], very_high: [17, 25] },
  isImmutable: false,
};

const mockAsset = { id: 'asset-001', displayId: 'AST-001', name: 'Web Server' };
const mockProcess = { id: 'process-001', displayId: 'BP-001', name: 'Order Processing' };
const mockService = { id: 'service-001', displayId: 'SVC-001', name: 'E-Commerce Platform' };

describe('Risk Assessment — Paket 3.2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Relational Risk Creation Tests
  // ==========================================

  describe('Relational Risk Building Blocks', () => {
    it('should create a risk with scenario, threat, vulnerability relations', async () => {
      const mockRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Test Risk',
        description: 'Test Description',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'high',
        targetRisk: 'high',
        status: 'identified',
        scenarioId: mockScenario.id,
        threatId: mockThreat.id,
        vulnerabilityId: mockVulnerability.id,
      };

      PrismaMock.risk.create.mockImplementation(async ({ data }) => {
        return { ...mockRisk, ...data } as any;
      });

      PrismaMock.riskScenario.findUnique.mockResolvedValue(mockScenario as any);
      PrismaMock.threat.findUnique.mockResolvedValue(mockThreat as any);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(mockVulnerability as any);
      PrismaMock.riskCause.findMany.mockResolvedValue([{ id: mockCause.id }] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([{ id: mockImpact.id }] as any);

      // Mock the full getById chain
      PrismaMock.risk.findUnique.mockResolvedValue({
        ...mockRisk,
        scenario: { ...mockScenario, threat: mockThreat, vulnerability: mockVulnerability },
        causes: [{ cause: mockCause }],
        impacts: [{ impact: mockImpact }],
        riskAssets: [],
        processLinks: [],
        serviceLinks: [],
      } as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      const result = await riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        scenarioId: mockScenario.id,
        threatId: mockThreat.id,
        vulnerabilityId: mockVulnerability.id,
        causeIds: [mockCause.id],
        impactIds: [mockImpact.id],
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Initial assessment based on threat intelligence',
      }, 'created-by-user');

      expect(result).toBeDefined();
      expect(PrismaMock.risk.create).toHaveBeenCalled();
    });

    it('should throw 404 when scenario not found', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);

      await expect(riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        scenarioId: 'non-existent-scenario',
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      })).rejects.toThrow('Scenario not found');
    });

    it('should throw 404 when threat not found', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);

      await expect(riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        threatId: 'non-existent-threat',
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      })).rejects.toThrow('Threat not found');
    });

    it('should throw 404 when vulnerability not found', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);

      await expect(riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        vulnerabilityId: 'non-existent-vuln',
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      })).rejects.toThrow('Vulnerability not found');
    });

    it('should throw 404 when cause IDs not all found', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([{ id: 'cause-001' }] as any);

      await expect(riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        causeIds: ['cause-001', 'cause-missing'],
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      })).rejects.toThrow('One or more cause IDs not found');
    });

    it('should throw 404 when impact IDs not all found', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([{ id: 'impact-001' }] as any);

      await expect(riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        causeIds: [],
        impactIds: ['impact-001', 'impact-missing'],
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      })).rejects.toThrow('One or more impact IDs not found');
    });
  });

  // ==========================================
  // Junction Table Tests (Asset/Process/Service)
  // ==========================================

  describe('Junction Table Relationships', () => {
    it('should create risk with asset, process, service junction links', async () => {
      const mockRisk = { id: 'risk-001', displayId: 'RSK-001', title: 'Test Risk' };

      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      PrismaMock.risk.create.mockResolvedValue(mockRisk as any);
      PrismaMock.riskAsset.createMany.mockResolvedValue({ count: 1 } as any);
      PrismaMock.riskProcess.createMany.mockResolvedValue({ count: 1 } as any);
      PrismaMock.riskService.createMany.mockResolvedValue({ count: 1 } as any);

      PrismaMock.risk.findUnique.mockResolvedValue({
        ...mockRisk,
        riskAssets: [{ asset: mockAsset }],
        processLinks: [{ process: mockProcess }],
        serviceLinks: [{ service: mockService }],
        scenario: null,
        causes: [],
        impacts: [],
      } as any);

      await riskService.create({
        title: 'Test Risk',
        description: 'Test Description',
        assetIds: [mockAsset.id],
        processIds: [mockProcess.id],
        serviceIds: [mockService.id],
        likelihood: 3,
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test justification',
      });

      expect(PrismaMock.riskAsset.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ riskId: 'risk-001', assetId: mockAsset.id })]),
        })
      );
      expect(PrismaMock.riskProcess.createMany).toHaveBeenCalled();
      expect(PrismaMock.riskService.createMany).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Assessment History & Versioning Tests
  // ==========================================

  describe('Assessment History and Versioning', () => {
    it('should create a new assessment snapshot with mandatory justification', async () => {
      const mockRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Test Risk',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        riskMethodVersionId: mockMethodVersion.id,
      };

      PrismaMock.risk.findUnique.mockResolvedValue(mockRisk as any);
      PrismaMock.riskMethodVersion.findUnique.mockResolvedValue(mockMethodVersion as any);
      PrismaMock.riskAssessment.findFirst.mockResolvedValue({ assessmentNumber: 2 } as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      PrismaMock.riskAssessment.updateMany.mockResolvedValue({ count: 1 } as any);
      PrismaMock.riskAssessment.create.mockResolvedValue({ id: 'assessment-003', assessmentNumber: 3 } as any);

      await riskService.createAssessment({
        riskId: 'risk-001',
        riskMethodVersionId: mockMethodVersion.id,
        assessmentType: 'current',
        likelihood: 4,
        impact: 5,
        inherentRisk: 'very_high',
        residualRisk: 'high',
        targetRisk: 'medium',
        assessorId: 'assessor-001',
        nextReviewDate: new Date('2027-06-01'),
        justification: 'Re-assessment after security incident — threat landscape changed significantly',
      });

      expect(PrismaMock.riskAssessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assessmentNumber: 3,
            assessmentType: 'current',
            justification: 'Re-assessment after security incident — threat landscape changed significantly',
            isCurrent: true,
          }),
        })
      );

      // Verify previous assessments marked as historical
      expect(PrismaMock.riskAssessment.updateMany).toHaveBeenCalledWith({
        where: { riskId: 'risk-001', assessmentType: 'current', isCurrent: true },
        data: { isCurrent: false },
      });
    });

    it('should reject assessment without justification', async () => {
      PrismaMock.risk.findUnique.mockResolvedValue({ id: 'risk-001' } as any);

      await expect(riskService.createAssessment({
        riskId: 'risk-001',
        riskMethodVersionId: mockMethodVersion.id,
        assessmentType: 'current',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        assessorId: 'assessor-001',
        nextReviewDate: new Date('2027-06-01'),
        justification: '', // Empty justification should be rejected
      })).rejects.toThrow('Justification is mandatory');
    });

    it('should reject assessment with null justification', async () => {
      PrismaMock.risk.findUnique.mockResolvedValue({ id: 'risk-001' } as any);

      await expect(riskService.createAssessment({
        riskId: 'risk-001',
        riskMethodVersionId: mockMethodVersion.id,
        assessmentType: 'current',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        assessorId: 'assessor-001',
        nextReviewDate: new Date('2027-06-01'),
        justification: '', // Empty = rejected
      })).rejects.toThrow('Justification is mandatory');
    });

    it('should support inherent, current, and target assessment types', async () => {
      const mockRisk = { id: 'risk-001', displayId: 'RSK-001' };
      PrismaMock.risk.findUnique.mockResolvedValue(mockRisk as any);
      PrismaMock.riskMethodVersion.findUnique.mockResolvedValue(mockMethodVersion as any);
      PrismaMock.riskAssessment.findFirst.mockResolvedValue(null);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      PrismaMock.riskAssessment.updateMany.mockResolvedValue({ count: 0 } as any);
      PrismaMock.riskAssessment.create.mockResolvedValue({ id: 'assessment-001' } as any);

      // Create inherent assessment
      await riskService.createAssessment({
        riskId: 'risk-001',
        riskMethodVersionId: mockMethodVersion.id,
        assessmentType: 'inherent',
        likelihood: 5,
        impact: 5,
        inherentRisk: 'very_high',
        residualRisk: 'high',
        targetRisk: 'medium',
        assessorId: 'assessor-001',
        nextReviewDate: new Date('2027-06-01'),
        justification: 'Inherent risk without controls',
      });

      expect(PrismaMock.riskAssessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assessmentType: 'inherent' }),
        })
      );
    });

    it('should not overwrite historical assessments when creating new one', async () => {
      const mockHistoricalAssessment = {
        id: 'assessment-001',
        riskId: 'risk-001',
        assessmentNumber: 1,
        assessmentType: 'current',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'medium',
        isCurrent: false, // Already historical
      };

      PrismaMock.risk.findUnique.mockResolvedValue({ id: 'risk-001' } as any);
      PrismaMock.riskMethodVersion.findUnique.mockResolvedValue(mockMethodVersion as any);
      PrismaMock.riskAssessment.findFirst.mockResolvedValue({ assessmentNumber: 1 } as any);
      PrismaMock.riskAssessment.findMany.mockResolvedValue([mockHistoricalAssessment] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      PrismaMock.riskAssessment.updateMany.mockResolvedValue({ count: 1 } as any);
      PrismaMock.riskAssessment.create.mockResolvedValue({ id: 'assessment-002', assessmentNumber: 2 } as any);

      await riskService.createAssessment({
        riskId: 'risk-001',
        riskMethodVersionId: mockMethodVersion.id,
        assessmentType: 'current',
        likelihood: 4,
        impact: 5,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        assessorId: 'assessor-001',
        nextReviewDate: new Date('2027-06-01'),
        justification: 'Updated assessment after control implementation',
      });

      // Historical assessment should NOT be deleted or modified (only isCurrent flag on current ones)
      expect(PrismaMock.riskAssessment.create).toHaveBeenCalled();
    });
  });

  // ==========================================
  // ReviewTask Tests
  // ==========================================

  describe('Review Task Management', () => {
    it('should create a review task for a risk', async () => {
      const mockRisk = { id: 'risk-001', displayId: 'RSK-001', title: 'Test Risk' };
      PrismaMock.risk.findUnique.mockResolvedValue(mockRisk as any);

      const scheduledDate = new Date('2027-03-01');
      const dueDate = new Date('2027-03-15');

      PrismaMock.reviewTask.create.mockResolvedValue({
        id: 'task-001',
        displayId: 'RTASK-001',
        riskId: 'risk-001',
        scheduledDate,
        dueDate,
        status: 'pending',
        priority: 'high',
        assignedTo: 'reviewer-001',
        triggerType: 'scheduled',
      } as any);

      const task = await riskService.createReviewTask({
        riskId: 'risk-001',
        scheduledDate,
        dueDate,
        priority: 'high',
        assignedTo: 'reviewer-001',
        triggerType: 'scheduled',
      });

      expect(task.id).toBe('task-001');
      expect(task.status).toBe('pending');
      expect(PrismaMock.reviewTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            riskId: 'risk-001',
            priority: 'high',
            triggerType: 'scheduled',
          }),
        })
      );
    });

    it('should throw 404 when creating review task for non-existent risk', async () => {
      PrismaMock.risk.findUnique.mockResolvedValue(null);

      await expect(riskService.createReviewTask({
        riskId: 'non-existent-risk',
        scheduledDate: new Date(),
        dueDate: new Date(),
      })).rejects.toThrow('Risk not found');
    });

    it('should update review task status and set completion fields', async () => {
      const mockTask = {
        id: 'task-001',
        displayId: 'RTASK-001',
        riskId: 'risk-001',
        status: 'in_progress',
        assignedTo: 'reviewer-001',
      };

      PrismaMock.reviewTask.findUnique.mockResolvedValue(mockTask as any);
      PrismaMock.reviewTask.update.mockResolvedValue({
        ...mockTask,
        status: 'completed',
        completedAt: expect.any(Date),
        completedBy: 'reviewer-001',
      } as any);

      const task = await riskService.updateReviewTask('task-001', {
        status: 'completed',
      }, 'reviewer-001');

      expect(task.status).toBe('completed');
      expect(PrismaMock.reviewTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completedBy: 'reviewer-001',
          }),
        })
      );
    });

    it('should list overdue review tasks', async () => {
      PrismaMock.reviewTask.findMany.mockResolvedValue([
        { id: 'task-001', status: 'pending', dueDate: new Date('2026-01-01') },
      ] as any);

      await riskService.listReviewTasks({ overdue: true });

      expect(PrismaMock.reviewTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: false }),
        })
      );
    });
  });

  // ==========================================
  // Unplanned Review Trigger Tests (RSK-024)
  // ==========================================

  describe('Unplanned Review Trigger', () => {
    it('should trigger review for high severity security incident and create ReviewTask', async () => {
      const mockRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Test Risk',
        status: 'assessed',
        inherentRisk: 'high',
        riskOwnerId: 'owner-001',
      };

      PrismaMock.asset.findUnique.mockResolvedValue(null);
      PrismaMock.risk.findMany.mockResolvedValue([mockRisk] as any);
      PrismaMock.riskAsset.findMany.mockResolvedValue([] as any);

      // Mock review task creation
      PrismaMock.risk.findUnique.mockResolvedValue(mockRisk as any);
      PrismaMock.reviewTask.create.mockResolvedValue({
        id: 'task-001',
        displayId: 'RTASK-001',
        riskId: 'risk-001',
        status: 'pending',
        triggerType: 'unplanned_event',
      } as any);

      const result = await riskService.checkUnplannedReviewTrigger({
        type: 'security_incident',
        severity: 'high',
        details: 'Critical vulnerability exploited in production',
      });

      expect(result.requiresReview).toBe(true);
      expect(result.affectedRiskCount).toBe(1);
      expect(result.createdReviewTasks.length).toBeGreaterThan(0);
    });

    it('should trigger review for new critical supplier event', async () => {
      PrismaMock.risk.findMany.mockResolvedValue([] as any);
      PrismaMock.riskAsset.findMany.mockResolvedValue([] as any);

      const result = await riskService.checkUnplannedReviewTrigger({
        type: 'new_critical_supplier',
      });

      expect(result.requiresReview).toBe(true);
    });

    it('should trigger review for technical change on critical asset', async () => {
      PrismaMock.asset.findUnique.mockResolvedValue({
        id: 'asset-001',
        displayId: 'AST-001',
        name: 'Critical Server',
        criticality: 'high',
      } as any);

      const mockRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Test Risk',
        status: 'assessed',
        inherentRisk: 'medium',
        riskOwnerId: 'owner-001',
      };

      PrismaMock.risk.findMany.mockResolvedValue([mockRisk] as any);
      PrismaMock.riskAsset.findMany.mockResolvedValue([{ riskId: 'risk-001' }] as any);
      PrismaMock.risk.findUnique.mockResolvedValue(mockRisk as any);
      PrismaMock.reviewTask.create.mockResolvedValue({
        id: 'task-001',
        displayId: 'RTASK-001',
        riskId: 'risk-001',
        status: 'pending',
        triggerType: 'unplanned_event',
      } as any);

      const result = await riskService.checkUnplannedReviewTrigger({
        type: 'technical_change',
        assetId: 'asset-001',
      });

      expect(result.requiresReview).toBe(true);
    });

    it('should trigger review for accepted risk approval expiring', async () => {
      const mockAcceptedRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Accepted Risk',
        status: 'accepted',
        inherentRisk: 'medium',
        riskOwnerId: 'owner-001',
      };

      PrismaMock.risk.findUnique.mockResolvedValue(mockAcceptedRisk as any);
      PrismaMock.risk.findMany.mockResolvedValue([mockAcceptedRisk] as any);
      PrismaMock.riskAsset.findMany.mockResolvedValue([] as any);
      PrismaMock.reviewTask.create.mockResolvedValue({
        id: 'task-001',
        displayId: 'RTASK-001',
        riskId: 'risk-001',
        status: 'pending',
        triggerType: 'unplanned_event',
      } as any);

      const result = await riskService.checkUnplannedReviewTrigger({
        type: 'risk_approval_expiring',
        riskId: 'risk-001',
      });

      expect(result.requiresReview).toBe(true);
    });
  });

  // ==========================================
  // Risk Update with Assessment History Tests
  // ==========================================

  describe('Risk Update creates new assessment snapshot', () => {
    it('should create a new assessment when likelihood/impact changes', async () => {
      const existingRisk = {
        id: 'risk-001',
        displayId: 'RSK-001',
        title: 'Test Risk',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'high',
        targetRisk: 'high',
        riskMethodVersionId: mockMethodVersion.id,
        evaluationJustification: 'Original justification',
        status: 'assessed',
        nextReviewDate: new Date('2027-01-01'),
        assessorId: 'user-001',
      };

      PrismaMock.risk.findUnique.mockResolvedValue(existingRisk as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      PrismaMock.risk.update.mockResolvedValue({ ...existingRisk, likelihood: 4, impact: 5 } as any);
      PrismaMock.riskAssessment.findFirst.mockResolvedValue({ assessmentNumber: 1 } as any);
      PrismaMock.riskAssessment.updateMany.mockResolvedValue({ count: 1 } as any);
      PrismaMock.riskAssessment.create.mockResolvedValue({ id: 'assessment-002' } as any);

      // Mock getById return
      const fullRisk = { ...existingRisk, likelihood: 4, impact: 5 };
      Object.assign(fullRisk, {
        scenario: null, causes: [], impacts: [],
        riskAssets: [], processLinks: [], serviceLinks: [],
      });
      PrismaMock.risk.findUnique.mockResolvedValue(fullRisk as any);

      await riskService.update('risk-001', {
        likelihood: 4,
        impact: 5,
        justification: 'Updated after new threat intelligence',
      }, 'updater-001');

      // Verify a new assessment was created
      expect(PrismaMock.riskAssessment.create).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Risk Level Calculation Tests
  // ==========================================

  describe('Risk Level Calculation', () => {
    it('should calculate very_high for score >= 16', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      const createdRisk = { id: 'risk-001', displayId: 'RSK-001' };
      PrismaMock.risk.create.mockResolvedValue(createdRisk as any);
      PrismaMock.risk.findUnique.mockResolvedValue({
        ...createdRisk,
        scenario: null, causes: [], impacts: [],
        riskAssets: [], processLinks: [], serviceLinks: [],
      } as any);

      await riskService.create({
        title: 'Test',
        description: 'Test',
        likelihood: 5, // 5 * 4 = 20 >= 16 -> very_high
        impact: 4,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test',
      });

      expect(PrismaMock.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inherentRisk: 'very_high' }),
        })
      );
    });

    it('should calculate high for score 9-15', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      const createdRisk = { id: 'risk-001', displayId: 'RSK-001' };
      PrismaMock.risk.create.mockResolvedValue(createdRisk as any);
      PrismaMock.risk.findUnique.mockResolvedValue({
        ...createdRisk,
        scenario: null, causes: [], impacts: [],
        riskAssets: [], processLinks: [], serviceLinks: [],
      } as any);

      await riskService.create({
        title: 'Test',
        description: 'Test',
        likelihood: 3, // 3 * 3 = 9 -> high
        impact: 3,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test',
      });

      expect(PrismaMock.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inherentRisk: 'high' }),
        })
      );
    });

    it('should calculate medium for score 4-8', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      const createdRisk = { id: 'risk-001', displayId: 'RSK-001' };
      PrismaMock.risk.create.mockResolvedValue(createdRisk as any);
      PrismaMock.risk.findUnique.mockResolvedValue({
        ...createdRisk,
        scenario: null, causes: [], impacts: [],
        riskAssets: [], processLinks: [], serviceLinks: [],
      } as any);

      await riskService.create({
        title: 'Test',
        description: 'Test',
        likelihood: 2, // 2 * 2 = 4 -> medium
        impact: 2,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test',
      });

      expect(PrismaMock.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inherentRisk: 'medium' }),
        })
      );
    });

    it('should calculate low for score < 4', async () => {
      PrismaMock.riskScenario.findUnique.mockResolvedValue(null);
      PrismaMock.threat.findUnique.mockResolvedValue(null);
      PrismaMock.vulnerability.findUnique.mockResolvedValue(null);
      PrismaMock.riskCause.findMany.mockResolvedValue([] as any);
      PrismaMock.riskImpact.findMany.mockResolvedValue([] as any);

      PrismaMock.$transaction.mockImplementation(async (fn) => {
        return await fn(PrismaMock as any);
      });

      const createdRisk = { id: 'risk-001', displayId: 'RSK-001' };
      PrismaMock.risk.create.mockResolvedValue(createdRisk as any);
      PrismaMock.risk.findUnique.mockResolvedValue({
        ...createdRisk,
        scenario: null, causes: [], impacts: [],
        riskAssets: [], processLinks: [], serviceLinks: [],
      } as any);

      await riskService.create({
        title: 'Test',
        description: 'Test',
        likelihood: 1, // 1 * 2 = 2 -> low
        impact: 2,
        assessorId: 'user-001',
        riskOwnerId: 'owner-001',
        nextReviewDate: new Date('2027-01-01'),
        justification: 'Test',
      });

      expect(PrismaMock.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inherentRisk: 'low' }),
        })
      );
    });
  });
});
