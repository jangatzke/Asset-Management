/**
 * Focused tests for ControlService.diffSoA — item-level comparison between two
 * Statement of Applicability versions (ISO 27001 Annex A change review).
 */

const store: Record<string, any> = {};

jest.mock('../config/database', () => {
  const prisma: any = {
    statementOfApplicability: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => store[where.id] ?? null),
    },
  };
  return { prisma };
});

import { controlService } from '../services/control.service';

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-x',
  controlId: 'ctrl-1',
  requirementId: null,
  applicability: 'applicable',
  justification: 'Required by risk assessment',
  implementationStatus: 'implemented',
  control: { id: 'ctrl-1', title: 'A.5.1 Policies for information security' },
  implementationLinks: [],
  riskLinks: [],
  ...overrides,
});

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('ControlService.diffSoA', () => {
  it('classifies added, removed and changed items between two versions', async () => {
    store['soa-1'] = {
      id: 'soa-1', version: 1, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-1', approvalStatus: 'approved',
      items: [
        buildItem({ id: 'item-keep' }),
        buildItem({ id: 'item-change', controlId: 'ctrl-2', control: { id: 'ctrl-2', title: 'A.5.7 Threat intelligence' }, applicability: 'applicable' }),
        buildItem({ id: 'item-remove', controlId: 'ctrl-3', control: { id: 'ctrl-3', title: 'A.5.9 Inventory of information and other associated assets' } }),
      ],
      approvals: [],
    };
    store['soa-2'] = {
      id: 'soa-2', version: 2, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-1', approvalStatus: 'draft',
      items: [
        buildItem({ id: 'item-keep' }),
        buildItem({ id: 'item-change', controlId: 'ctrl-2', control: { id: 'ctrl-2', title: 'A.5.7 Threat intelligence' }, applicability: 'not_applicable', justification: 'Risk accepted by management' }),
        buildItem({ id: 'item-new', controlId: 'ctrl-4', control: { id: 'ctrl-4', title: 'A.5.10 Acceptable use of information' } }),
      ],
      approvals: [],
    };

    const diff = await controlService.diffSoA('soa-1', 'soa-2');

    expect(diff.comparable).toBe(true);
    expect(diff.from).toMatchObject({ id: 'soa-1', version: 1, approvalStatus: 'approved' });
    expect(diff.to).toMatchObject({ id: 'soa-2', version: 2, approvalStatus: 'draft' });

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toMatchObject({ key: 'ctrl-4', controlTitle: 'A.5.10 Acceptable use of information' });

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toMatchObject({ key: 'ctrl-3' });

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ key: 'ctrl-2', controlTitle: 'A.5.7 Threat intelligence' });
    expect(diff.changed[0].fields.applicability).toEqual({ from: 'applicable', to: 'not_applicable' });
    expect(diff.changed[0].fields.justification).toEqual({ from: 'Required by risk assessment', to: 'Risk accepted by management' });
    expect(diff.changed[0].fields.implementationStatus).toBeUndefined();

    expect(diff.summary).toEqual({ addedCount: 1, removedCount: 1, changedCount: 1, unchangedCount: 1 });
  });

  it('flags cross-scope or cross-framework comparisons as not comparable', async () => {
    store['soa-a'] = {
      id: 'soa-a', version: 1, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-1', approvalStatus: 'approved',
      items: [], approvals: [],
    };
    store['soa-b'] = {
      id: 'soa-b', version: 1, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-2', approvalStatus: 'approved',
      items: [], approvals: [],
    };

    const diff = await controlService.diffSoA('soa-a', 'soa-b');
    expect(diff.comparable).toBe(false);
  });

  it('reports an empty diff for identical versions without rejecting them', async () => {
    store['soa-x'] = {
      id: 'soa-x', version: 1, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-1', approvalStatus: 'approved',
      items: [buildItem({ id: 'item-1' })], approvals: [],
    };
    store['soa-y'] = {
      id: 'soa-y', version: 2, frameworkId: 'ISO27001-ANNEX-A-2022', frameworkVersion: '2022', scopeId: 'scope-1', approvalStatus: 'approved',
      items: [buildItem({ id: 'item-1' })], approvals: [],
    };

    const diff = await controlService.diffSoA('soa-x', 'soa-y');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.summary.unchangedCount).toBe(1);
  });

  it('rejects invalid inputs and missing SoAs', async () => {
    await expect(controlService.diffSoA('', 'soa-2')).rejects.toThrow(/required/i);
    await expect(controlService.diffSoA('soa-1', 'soa-1')).rejects.toThrow(/itself/i);
    await expect(controlService.diffSoA('missing-1', 'missing-2')).rejects.toThrow(/not found/i);
  });
});
