/**
 * Focused tests for ControlService.coverageMatrix — ISO 27001 control-to-CI
 * coverage aggregation over the ControlAsset junction (gap detection).
 */

const mocks = {
  assetFindMany: jest.fn(),
  controlAssetFindMany: jest.fn(),
  controlFindMany: jest.fn(),
};

jest.mock('../config/database', () => {
  const prisma: any = {
    asset: { findMany: (...args: any[]) => mocks.assetFindMany(...args) },
    controlAsset: { findMany: (...args: any[]) => mocks.controlAssetFindMany(...args) },
    control: { findMany: (...args: any[]) => mocks.controlFindMany(...args) },
  };
  return { prisma };
});

import { controlService } from '../services/control.service';

const buildAsset = (overrides: Record<string, unknown> = {}) => ({
  id: 'asset-1',
  displayId: 'AST-0001',
  name: 'Firewall Core',
  criticality: 'medium',
  lifecycleStatus: 'active',
  complianceRelevance: false,
  dataProtectionRelevance: false,
  ...overrides,
});

const buildControl = (overrides: Record<string, unknown> = {}) => ({
  id: 'ctrl-1',
  title: 'A.5.1 Policies for information security',
  catalogId: 'A.5.1',
  catalogVersion: '2022',
  implementationStatus: 'implemented',
  applicability: 'applicable',
  ...overrides,
});

beforeEach(() => {
  mocks.assetFindMany.mockReset().mockResolvedValue([]);
  mocks.controlAssetFindMany.mockReset().mockResolvedValue([]);
  mocks.controlFindMany.mockReset().mockResolvedValue([]);
});

describe('ControlService.coverageMatrix', () => {
  it('maps search and criticality filters onto the asset where clause', async () => {
    await controlService.coverageMatrix({ search: 'fire', criticality: 'high' });

    expect(mocks.assetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isArchived: false,
          criticality: 'high',
          OR: [
            { name: { contains: 'fire', mode: 'insensitive' } },
            { displayId: { contains: 'fire', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('aggregates linked controls, flags gaps and counts effective coverage', async () => {
    mocks.assetFindMany.mockResolvedValue([
      buildAsset({ id: 'asset-covered', name: 'Covered Server', criticality: 'critical' }),
      buildAsset({ id: 'asset-gap', name: 'Uncovered Laptop', criticality: 'high' }),
    ]);
    mocks.controlAssetFindMany.mockResolvedValue([
      { controlId: 'ctrl-effective', assetId: 'asset-covered' },
      { controlId: 'ctrl-planned', assetId: 'asset-covered' },
      // Archived/inactive control must be dropped because the control query filters it out.
      { controlId: 'ctrl-inactive', assetId: 'asset-covered' },
      { controlId: 'ctrl-other-asset', assetId: 'asset-not-loaded' },
    ]);
    mocks.controlFindMany.mockResolvedValue([
      buildControl({ id: 'ctrl-effective', title: 'A.8.1 User endpoint devices', implementationStatus: 'effective' }),
      buildControl({ id: 'ctrl-planned', title: 'A.5.9 Inventory of information and other associated assets', implementationStatus: 'planned' }),
    ]);

    const result = await controlService.coverageMatrix();

    expect(mocks.controlFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ctrl-effective', 'ctrl-planned', 'ctrl-inactive', 'ctrl-other-asset'] }, isArchived: false, status: 'active' },
      }),
    );

    expect(result.summary).toEqual({
      totalAssets: 2,
      coveredAssets: 1,
      uncoveredAssets: 1,
      criticalUncovered: 1,
    });

    // Critical first, then high; both are gap rows for the summary check.
    expect(result.rows.map((row: any) => row.id)).toEqual(['asset-covered', 'asset-gap']);

    const covered = result.rows.find((row: any) => row.id === 'asset-covered');
    expect(covered.uncovered).toBe(false);
    expect(covered.coverageCount).toBe(2);
    expect(covered.effectiveCoverageCount).toBe(1);
    // Controls are sorted by title for a stable detail view ("A.5.9..." before "A.8.1...").
    expect(covered.controls.map((control: any) => control.id)).toEqual(['ctrl-planned', 'ctrl-effective']);

    const gap = result.rows.find((row: any) => row.id === 'asset-gap');
    expect(gap.uncovered).toBe(true);
    expect(gap.coverageCount).toBe(0);
    expect(gap.effectiveCoverageCount).toBe(0);
  });

  it('orders rows by criticality rank descending and name ascending', async () => {
    mocks.assetFindMany.mockResolvedValue([
      buildAsset({ id: 'a-low', name: 'zz-low', criticality: 'low' }),
      buildAsset({ id: 'a-critical-b', name: 'b-critical', criticality: 'critical' }),
      buildAsset({ id: 'a-critical-a', name: 'a-critical', criticality: 'critical' }),
      buildAsset({ id: 'a-high', name: 'aa-high', criticality: 'high' }),
    ]);

    const result = await controlService.coverageMatrix();

    expect(result.rows.map((row: any) => row.id)).toEqual(['a-critical-a', 'a-critical-b', 'a-high', 'a-low']);
    expect(result.summary.criticalUncovered).toBe(3);
  });
});
