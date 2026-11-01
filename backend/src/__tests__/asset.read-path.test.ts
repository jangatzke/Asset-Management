/**
 * Phase 2.5 read-path performance contract.
 *
 * Baseline measured against the pre-2.5 implementation of AssetService:
 *  - getById: 1 asset delegate call (findUnique) with 11 relations loaded as
 *    complete models (`include: { ... : true }`).
 *  - list: 2 delegate calls (findMany + count) with 9 relations loaded as
 *    complete models.
 * Both methods never contained an application-level loop; the N+1 risk came
 * from Prisma expanding each nested `include` into its own relation query per
 * loaded relation. Phase 2.5 keeps the delegate-call counts identical (1 and 2)
 * but narrows every nested relation to the fields the frontend contract
 * declares, so the relation payloads (and therefore the per-relation column
 * sets) shrink without changing the envelope or response keys.
 *
 * This test pins that behavior and separately proves that serializeEntity
 * remains the DTO boundary (credential-like keys never reach the response).
 */

import { jest } from '@jest/globals';

var mockPrisma = {
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn() },
}));

jest.mock('../services/displayId.service', () => ({
  nextDisplayId: jest.fn(),
  displayIdService: { nextDisplayId: jest.fn() },
}));

jest.mock('../services/entityHistory.service', () => ({
  recordCreateHistory: jest.fn(),
  recordUpdateHistory: jest.fn(),
  recordDeleteHistory: jest.fn(),
  toHistoryData: jest.fn(),
  resolveActorName: jest.fn(),
  resolveActorNames: jest.fn(),
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {},
}));

const { AssetService } = require('../services/asset.service');

const BASELINE_GET_BY_ID_DELEGATE_CALLS = 1;
const BASELINE_LIST_DELEGATE_CALLS = 2;
const BASELINE_GET_BY_ID_RELATIONS = 11;
const BASELINE_LIST_RELATIONS = 9;

const SECRET_VALUES = ['$2b$10$shouldneverleak', 'JBSWY3DPEHPK3PXP', 'oauth-secret-value', 'connector-secret-value'];

function collectKeys(value: unknown, seen: Set<string> = new Set()): Set<string> {
  const keys = new Set<string>();
  if (!value || typeof value !== 'object') return keys;
  if (seen.has(value as object as string)) return keys;
  seen.add(value as object as string);
  if (Array.isArray(value)) {
    for (const entry of value) {
      for (const key of collectKeys(entry, seen)) keys.add(key);
    }
    return keys;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    for (const nested of collectKeys(child, seen)) keys.add(nested);
  }
  return keys;
}

function expectNoSecretKeys(body: unknown): void {
  const keys = collectKeys(body);
  for (const secret of ['passwordHash', 'mfaSecret', 'mfaPendingSecret', 'clientSecret', 'clientSecretRef', 'connectorSecret', 'apiTokenHash', 'accessTokenHash']) {
    expect(keys.has(secret)).toBe(false);
  }
  const serialized = JSON.stringify(body);
  for (const raw of SECRET_VALUES) {
    expect(serialized).not.toContain(raw);
  }
}

const assetRow = {
  id: 'asset-1',
  displayId: 'ASSET-0001',
  name: 'Web Server',
  inventoryNumber: 'INV-001',
  criticality: 'high',
  lifecycleStatus: 'active',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  assetType: { id: 'type-1', name: 'Hardware', inventoryEnabled: true, inventoryPattern: 'SRV####' },
  assetSubtype: { id: 'subtype-1', name: 'Server' },
  organizationUnit: { id: 'ou-1', name: 'IT' },
  location: { id: 'loc-1', name: 'Data Center', address: 'Main Street 1' },
  networkAddresses: [{ id: 'na-1', address: '10.0.0.1', type: 'ipv4' }],
  processLinks: [{ processId: 'proc-1', process: { id: 'proc-1', displayId: 'PROC-0001', name: 'Order Processing' } }],
  serviceLinks: [{ serviceId: 'svc-1', service: { id: 'svc-1', displayId: 'SVC-0001', name: 'Mail' } }],
  // Contract/License (schema.prisma) expose id/displayId/title only — there is
  // no contractNumber/licenseNumber column, so the projection selects title.
  contractLinks: [{
    contractId: 'ctr-1',
    contract: { id: 'ctr-1', displayId: 'CTR-0001', title: 'Support', connectorSecret: 'connector-secret-value' },
  }],
  licenseLinks: [{
    licenseId: 'lic-1',
    license: { id: 'lic-1', displayId: 'LIC-0001', title: 'Windows', clientSecret: 'oauth-secret-value' },
  }],
  sourceRelations: [{ targetAssetId: 'asset-2', relationshipType: 'depends_on', targetAsset: { id: 'asset-2', displayId: 'ASSET-0002', name: 'DB' } }],
  targetRelations: [{ sourceAssetId: 'asset-3', relationshipType: 'depends_on', sourceAsset: { id: 'asset-3', displayId: 'ASSET-0003', name: 'Proxy' } }],
  // Boundary probe: a relation that (in the mocked DB row) still carries secrets.
  ownerRelation: {
    id: 'user-1',
    email: 'owner@example.com',
    passwordHash: '$2b$10$shouldneverleak',
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    apiTokenHash: 'abc123hash',
    createdBy: 'admin-1',
  },
};

describe('AssetService read path (Phase 2.5)', () => {
  let service: InstanceType<typeof AssetService>;

  beforeEach(() => {
    mockPrisma.asset.findUnique.mockResolvedValue(assetRow);
    mockPrisma.asset.findMany.mockResolvedValue([assetRow]);
    mockPrisma.asset.count.mockResolvedValue(1);
    service = new AssetService();
  });

  describe('query-count baseline', () => {
    it('getById keeps the baseline delegate count (1 findUnique, no app-level loop)', async () => {
      await service.getById('asset-1');

      expect(mockPrisma.asset.findUnique).toHaveBeenCalledTimes(BASELINE_GET_BY_ID_DELEGATE_CALLS);
      expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    });

    it('list keeps the baseline delegate count (findMany + count)', async () => {
      const result = await service.list({});

      expect(mockPrisma.asset.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.asset.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.asset.findMany.mock.calls.length + mockPrisma.asset.count.mock.calls.length)
        .toBe(BASELINE_LIST_DELEGATE_CALLS);
      expect(result.pagination.total).toBe(1);
    });

    it('getById keeps all 11 relation keys but narrows each via select instead of full-model include', async () => {
      await service.getById('asset-1');
      const args = mockPrisma.asset.findUnique.mock.calls[0][0];
      const include = args.include as Record<string, any>;

      expect(Object.keys(include)).toHaveLength(BASELINE_GET_BY_ID_RELATIONS);
      expect(include.networkAddresses).toBe(true);
      for (const relation of ['assetType', 'assetSubtype', 'organizationUnit', 'location', 'sourceRelations', 'targetRelations', 'processLinks', 'serviceLinks', 'contractLinks', 'licenseLinks']) {
        expect(include[relation].select).toBeDefined();
        expect(include[relation].include).toBeUndefined();
      }
      expect(include.sourceRelations.select.targetAssetId).toBe(true);
      expect(include.targetRelations.select.sourceAssetId).toBe(true);
    });

    it('list keeps the pinned include keys and narrows the junction relations via select', async () => {
      await service.list({});
      const args = mockPrisma.asset.findMany.mock.calls[0][0];
      const include = args.include as Record<string, any>;

      expect(Object.keys(include)).toHaveLength(BASELINE_LIST_RELATIONS);
      // asset.crud.test.ts pins these exact keys; they must survive.
      expect(include.networkAddresses).toBe(true);
      expect(include.processLinks).toBeDefined();
      expect(include.serviceLinks).toBeDefined();
      expect(include.contractLinks).toBeDefined();
      expect(include.licenseLinks).toBeDefined();
      for (const relation of ['assetType', 'assetSubtype', 'organizationUnit', 'location', 'processLinks', 'serviceLinks', 'contractLinks', 'licenseLinks']) {
        expect(include[relation].select).toBeDefined();
        expect(include[relation].include).toBeUndefined();
      }
    });
  });

  describe('D1 envelope contract', () => {
    it('list returns exactly { data, pagination: { page, limit, total, totalPages } }', async () => {
      const result: any = await service.list({});

      expect(Object.keys(result).sort()).toEqual(['data', 'pagination']);
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('frontend list fields survive projection', () => {
    it('keeps every field the Assets.tsx table and CSV export read', async () => {
      const result: any = await service.list({});
      const row = result.data[0];

      // Assets.tsx table + CSV export: id, displayId, name, inventoryNumber,
      // assetType.name, assetSubtype.name, criticality, lifecycleStatus/status.
      expect(row.id).toBe('asset-1');
      expect(row.displayId).toBe('ASSET-0001');
      expect(row.name).toBe('Web Server');
      expect(row.inventoryNumber).toBe('INV-001');
      expect(row.assetType.name).toBe('Hardware');
      expect(row.assetSubtype.name).toBe('Server');
      expect(row.criticality).toBe('high');
      expect(row.lifecycleStatus).toBe('active');
      expect(row.status).toBe('active');
    });

    it('keeps every field Assets.tsx handleEdit and AssetDetail.tsx read from getById', async () => {
      const asset: any = await service.getById('asset-1');

      // handleEdit: contractLinks[0], licenseLinks[0], sourceRelations, type/subtype ids,
      // organizationUnit/location labels.
      // Assets.tsx falls back from contractNumber/licenseNumber to title.
      expect(asset.contractLinks[0].contractId).toBe('ctr-1');
      expect(asset.contractLinks[0].contract.title).toBe('Support');
      expect(asset.licenseLinks[0].licenseId).toBe('lic-1');
      expect(asset.licenseLinks[0].license.title).toBe('Windows');
      expect(asset.sourceRelations[0].targetAssetId).toBe('asset-2');
      expect(asset.sourceRelations[0].targetAsset.name).toBe('DB');
      expect(asset.targetRelations[0].sourceAsset.name).toBe('Proxy');
      expect(asset.assetType.id).toBe('type-1');
      expect(asset.assetSubtype.id).toBe('subtype-1');
      expect(asset.organizationUnit.name).toBe('IT');
      expect(asset.location.address).toBe('Main Street 1');
      expect(asset.processLinks[0].process.displayId).toBe('PROC-0001');
      expect(asset.networkAddresses).toHaveLength(1);

      // AssetDetail.tsx scalar fields + dates pass through untouched.
      expect(asset.inventoryNumber).toBe('INV-001');
      expect(asset.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('DTO boundary (serializeEntity) is unchanged', () => {
    it('getById redacts credential-like keys even if a relation row carries them', async () => {
      const asset: any = await service.getById('asset-1');

      expectNoSecretKeys(asset);
      // Non-secret identity context still survives the redaction.
      expect(asset.ownerRelation.email).toBe('owner@example.com');
      expect(asset.ownerRelation.createdBy).toBe('admin-1');
    });

    it('list redacts credential-like keys from nested relations', async () => {
      const result: any = await service.list({});
      expectNoSecretKeys(result);
    });
  });
});
