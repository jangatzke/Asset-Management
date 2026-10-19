/**
 * Unit tests for SupplierService.supplyChainOverview (NIS2 Art. 21(2)(d)).
 * Prisma is mocked per model; the service aggregates legacy junction relations,
 * computes summary counters and sorts by criticality rank.
 */

jest.mock('../config/database', () => {
  const prisma: any = {
    supplier: { findMany: jest.fn().mockResolvedValue([]) },
    supplierContractRelation: { findMany: jest.fn().mockResolvedValue([]) },
    supplierRiskRelation: { findMany: jest.fn().mockResolvedValue([]) },
    supplierAssessment: { findMany: jest.fn().mockResolvedValue([]) },
    contract: { findMany: jest.fn().mockResolvedValue([]) },
    risk: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma };
});

jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../config/database';
import { supplierService } from '../services/supplier.service';

const mockedPrisma = prisma as any;

const baseSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: 'sup-1',
  displayId: 'SUP-00001',
  legalName: 'Acme Cloud GmbH',
  servicesProvided: 'IaaS hosting',
  criticality: 'medium',
  nis2Relevant: false,
  dataProtectionRelevant: true,
  status: 'active',
  exitStrategy: 'Migration to secondary provider',
  nextReviewDate: null,
  assessmentScore: null,
  assessmentRating: null,
  certifications: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.supplier.findMany.mockResolvedValue([]);
  mockedPrisma.supplierContractRelation.findMany.mockResolvedValue([]);
  mockedPrisma.supplierRiskRelation.findMany.mockResolvedValue([]);
  mockedPrisma.supplierAssessment.findMany.mockResolvedValue([]);
  mockedPrisma.contract.findMany.mockResolvedValue([]);
  mockedPrisma.risk.findMany.mockResolvedValue([]);
});

describe('SupplierService.supplyChainOverview', () => {
  it('maps criticality, nis2Relevant and search filters onto the supplier where clause', async () => {
    await supplierService.supplyChainOverview({ criticality: 'high', nis2Relevant: 'true', search: 'acme' });

    const call = mockedPrisma.supplier.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      isArchived: false,
      criticality: 'high',
      nis2Relevant: true,
      OR: [
        { legalName: { contains: 'acme', mode: 'insensitive' } },
        { servicesProvided: { contains: 'acme', mode: 'insensitive' } },
      ],
    });
  });

  it('aggregates linked contracts and risks with summary counters and flags', async () => {
    const now = new Date();
    const pastReview = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    mockedPrisma.supplier.findMany.mockResolvedValue([
      baseSupplier({ nextReviewDate: pastReview }),
      baseSupplier({ id: 'sup-2', displayId: 'SUP-00002', legalName: 'Beta Logistics SA', nis2Relevant: true, criticality: 'critical', exitStrategy: null, nextReviewDate: null }),
    ]);
    mockedPrisma.supplierContractRelation.findMany.mockResolvedValue([
      { supplierId: 'sup-1', contractId: 'contract-1' },
      { supplierId: 'sup-1', contractId: 'contract-archived' },
    ]);
    mockedPrisma.supplierRiskRelation.findMany.mockResolvedValue([
      { supplierId: 'sup-1', riskId: 'risk-open' },
      { supplierId: 'sup-1', riskId: 'risk-closed' },
      { supplierId: 'sup-2', riskId: 'risk-treated' },
    ]);
    mockedPrisma.contract.findMany.mockResolvedValue([
      { id: 'contract-1', displayId: 'CON-00001', title: 'Hosting agreement', contractType: 'service', renewalDate: null, endDate: null, status: 'active', isArchived: false },
      { id: 'contract-archived', displayId: 'CON-00002', title: 'Old agreement', contractType: 'service', renewalDate: null, endDate: null, status: 'expired', isArchived: true },
    ]);
    mockedPrisma.risk.findMany.mockResolvedValue([
      { id: 'risk-open', displayId: 'RSK-00001', title: 'Vendor lock-in', residualRisk: 'high', status: 'open', isArchived: false },
      { id: 'risk-closed', displayId: 'RSK-00002', title: 'Closed risk', residualRisk: 'low', status: 'closed', isArchived: false },
      { id: 'risk-treated', displayId: 'RSK-00003', title: 'Treated risk', residualRisk: 'medium', status: 'treated', isArchived: false },
    ]);
    mockedPrisma.supplierAssessment.findMany.mockResolvedValue([
      { supplierId: 'sup-1', assessmentDate: new Date('2026-05-01'), rating: 'good', score: 80, status: 'completed' },
      { supplierId: 'sup-1', assessmentDate: new Date('2025-01-01'), rating: 'poor', score: 20, status: 'completed' },
    ]);

    const result = await supplierService.supplyChainOverview();

    expect(result.summary).toEqual({
      totalSuppliers: 2,
      nis2Relevant: 1,
      criticalHigh: 1,
      missingExitStrategy: 1,
      reviewOverdue: 1,
    });

    const first = result.suppliers[0];
    expect(first.id).toBe('sup-2'); // critical sorts before medium
    expect(first.reviewOverdue).toBe(false);
    expect(first.missingExitStrategy).toBe(true);
    expect(first.contractCount).toBe(0);
    expect(first.openRiskCount).toBe(0);
    expect(first.latestAssessment).toBeNull();

    const second = result.suppliers[1];
    expect(second.id).toBe('sup-1');
    expect(second.reviewOverdue).toBe(true);
    expect(second.missingExitStrategy).toBe(false);
    // Archived contracts are excluded from the linked list.
    expect(second.contractCount).toBe(1);
    expect(second.contracts[0].id).toBe('contract-1');
    // Closed and treated risks do not count as open.
    expect(second.openRiskCount).toBe(1);
    expect(second.risks).toHaveLength(2);
    // The assessments query is ordered desc, so the first entry per supplier wins.
    expect(second.latestAssessment.rating).toBe('good');
  });

  it('sorts by criticality rank descending and legal name ascending', async () => {
    mockedPrisma.supplier.findMany.mockResolvedValue([
      baseSupplier({ id: 'sup-low', legalName: 'AAA Low', criticality: 'low' }),
      baseSupplier({ id: 'sup-critical', legalName: 'ZZZ Critical', criticality: 'critical' }),
      baseSupplier({ id: 'sup-high-b', legalName: 'High B', criticality: 'high' }),
      baseSupplier({ id: 'sup-high-a', legalName: 'High A', criticality: 'high' }),
    ]);

    const result = await supplierService.supplyChainOverview();

    expect(result.suppliers.map((supplier: any) => supplier.id)).toEqual([
      'sup-critical',
      'sup-high-a',
      'sup-high-b',
      'sup-low',
    ]);
  });
});
