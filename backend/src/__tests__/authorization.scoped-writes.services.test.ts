/**
 * Service-level authorization tests for scoped write paths.
 *
 * Scope of this suite (docs/authorization-gap-analysis.md §11.7):
 * - Exercises the REAL `AssetService`, `RiskService`, `ControlService` and the
 *   REAL singleton `authorizationService`. Only persistence (`prisma`) and the
 *   non-authorization collaborators (audit log, display ids, history, user
 *   reference validation, risk method, catalog) are replaced, so the
 *   authorization gates that live *inside* the services are under test.
 * - Negative paths: missing permission, out-of-scope (cross-entity) target
 *   organization unit, entity outside the authorized scope, and the resulting
 *   "authorization denials" that must happen BEFORE any write happens.
 * - Positive control paths use a downstream marker error: the test replaces the
 *   first persistence call after the authorization gate with a rejection
 *   sentinel. Reaching the sentinel proves the gate was passed, so a 403
 *   regression cannot be masked by a downstream failure.
 *
 * IMPORTANT: `../services/authorization.service` is intentionally NOT mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

// Non-authorization collaborators only.
const mockAuditService = { logEventStandalone: jest.fn<any>(), logEvent: jest.fn<any>() };
const mockNextDisplayId = jest.fn<any>();
const mockDisplayIdService = { nextDisplayIdStandalone: jest.fn<any>() };
const mockRecordCreateHistory = jest.fn<any>();
const mockRecordUpdateHistory = jest.fn<any>();
const mockRecordDeleteHistory = jest.fn<any>();
const mockToHistoryData = jest.fn<any>();
const mockValidateUserReferences = jest.fn<any>();
const mockRiskMethodService = { calculateRiskScore: jest.fn<any>() };
const mockCatalogService = { ensureIso27001AnnexA2022Catalog: jest.fn<any>() };

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: mockAuditService }));
jest.mock('../services/displayId.service', () => ({
  nextDisplayId: mockNextDisplayId,
  displayIdService: mockDisplayIdService,
}));
jest.mock('../services/entityHistory.service', () => ({
  recordCreateHistory: mockRecordCreateHistory,
  recordUpdateHistory: mockRecordUpdateHistory,
  recordDeleteHistory: mockRecordDeleteHistory,
  toHistoryData: mockToHistoryData,
}));
jest.mock('../services/userReference.service', () => ({
  validateUserReferences: mockValidateUserReferences,
}));
jest.mock('../services/riskmethod.service', () => ({ riskMethodService: mockRiskMethodService }));
jest.mock('../services/catalog.service', () => ({ catalogService: mockCatalogService }));

import { AssetService } from '../services/asset.service';
import { RiskService } from '../services/risk.service';
import { ControlService } from '../services/control.service';
import { authorizationService } from '../services/authorization.service';
import { AppError } from '../middleware/errorHandler';

const USER_ID = 'user-1';
const LE_A = 'le-a';
const LE_B = 'le-b';
const OU_A = 'ou-a';
const OU_B = 'ou-b';
const ASSET_UUID = '11111111-1111-4111-8111-111111111111';
const TARGET_ASSET_UUID = '22222222-2222-4222-8222-222222222222';
const ASSET_TYPE_UUID = '33333333-3333-4333-8333-333333333333';
const RISK_UUID = '44444444-4444-4444-8444-444444444444';
const CONTROL_UUID = '55555555-5555-4555-8555-555555555555';
const IMPLEMENTATION_UUID = '66666666-6666-4666-8666-666666666666';

const SCOPE_DENIED = 'Authorization denied: assets.write required for target scope';
const RISK_SCOPE_DENIED = 'Authorization denied: risks.write required for target scope';
const CONTROL_SCOPE_DENIED = 'Authorization denied: controls.write required for target scope';

// Sentinel thrown by the first persistence call AFTER the authorization gate.
const downstreamMarker = new Error('DOWNSTREAM_MARKER');

const assetService = new AssetService();
const riskService = new RiskService();
const controlService = new ControlService();

const ORGANIZATION_UNITS: Record<string, { id: string; legalEntityId: string }> = {
  [OU_A]: { id: OU_A, legalEntityId: LE_A },
  [OU_B]: { id: OU_B, legalEntityId: LE_B },
};

function roleRow(permissions: string[], scope: { legalEntityId?: string; organizationUnitId?: string } = {}) {
  return {
    userId: USER_ID,
    roleName: 'scoped-writer',
    legalEntityId: scope.legalEntityId ?? null,
    organizationUnitId: scope.organizationUnitId ?? null,
    scopeId: null,
    siteId: null,
    validFrom: null,
    validUntil: null,
    role: {
      rolePermissions: permissions.map((name) => ({ permission: { name } })),
    },
  };
}

function grantRoles(...rows: any[]) {
  mockPrisma.userRole.findMany.mockResolvedValue(rows as any);
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the operation to reject, but it resolved successfully');
}

async function expectDenied(operation: () => Promise<unknown>, message: string, statusCode = 403): Promise<void> {
  const error = await capture(operation());
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).message).toBe(message);
}

async function expectMarker(operation: () => Promise<unknown>): Promise<void> {
  const error = await capture(operation());
  expect(error).toBe(downstreamMarker);
  expect((error as Error).message).toBe('DOWNSTREAM_MARKER');
}

// Per-test mutable lookup targets (kept outside describe blocks for clarity).
// Existing asset OU / risk OU are what `resolveEntityScope` reads; the payload
// supplies the *target* scope.
let assetExistingOu = OU_A;
let relationTargetOu = OU_B;
let riskEntityOu = OU_A;

beforeEach(() => {
  const mock = mockPrisma as any;
  // Role resolution defaults: no roles unless a test grants them.
  mock.userRole.findMany.mockReset();
  mock.userRole.findMany.mockResolvedValue([] as any);
  mock.userGroup.findMany.mockResolvedValue([] as any);
  mock.ismsScopeLegalEntity.findMany.mockResolvedValue([] as any);

  // Scope resolution lookups.
  mock.organizationUnit.findUnique.mockReset();
  mock.organizationUnit.findUnique.mockImplementation(async (args: any) => ORGANIZATION_UNITS[args?.where?.id] ?? null);
  mock.site.findUnique.mockReset();
  mock.site.findUnique.mockResolvedValue(null as any);
  mock.controlImplementation.findUnique.mockResolvedValue(null as any);

  // Entity lookups (assets / risks / controls).
  mock.asset.findUnique.mockReset();
  mock.asset.findUnique.mockImplementation(async (args: any) => {
    const id: string | undefined = args?.where?.id;
    const withScope = Boolean(args?.include?.organizationUnit || args?.include?.location);
    if (id === ASSET_UUID) {
      return withScope
        ? { id: ASSET_UUID, organizationUnitId: assetExistingOu, locationId: null, organizationUnit: { legalEntityId: ORGANIZATION_UNITS[assetExistingOu]?.legalEntityId ?? LE_A }, location: null }
        : { id: ASSET_UUID, name: 'Existing asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: assetExistingOu, locationId: null, isArchived: false, archivedAt: null };
    }
    if (id === TARGET_ASSET_UUID) {
      return withScope
        ? { id: TARGET_ASSET_UUID, organizationUnitId: relationTargetOu, locationId: null, organizationUnit: { legalEntityId: ORGANIZATION_UNITS[relationTargetOu]?.legalEntityId ?? LE_B }, location: null }
        : { id: TARGET_ASSET_UUID, organizationUnitId: relationTargetOu };
    }
    return null;
  });

  mock.risk.findUnique.mockReset();
  mock.risk.findUnique.mockImplementation(async (args: any) => {
    if (args?.include?.organizationUnit) {
      return { id: RISK_UUID, organizationUnitId: riskEntityOu, organizationUnit: { legalEntityId: ORGANIZATION_UNITS[riskEntityOu]?.legalEntityId ?? LE_A } };
    }
    return { id: RISK_UUID, title: 'Existing risk', organizationUnitId: riskEntityOu, isArchived: false };
  });

  mock.control.findUnique.mockReset();
  mock.control.findUnique.mockImplementation(async (args: any) => {
    const id: string | undefined = args?.where?.id;
    if (!id) return null;
    // `select: { id: true }` catalog-only probe from resolveEntityScope.
    if (args?.select) return { id };
    return { id: CONTROL_UUID, title: 'Control 5.1' };
  });

  // Downstream persistence defaults.
  mock.$transaction.mockReset();
  mock.$transaction.mockResolvedValue(undefined as any);
  mock.assetRelation.create.mockReset();
  mock.assetRelation.create.mockResolvedValue({ id: 'relation-1' } as any);
  mock.controlImplementation.create.mockReset();
  mock.controlImplementation.create.mockResolvedValue({ id: IMPLEMENTATION_UUID } as any);

  // Collaborator defaults.
  mockAuditService.logEventStandalone.mockReset();
  mockAuditService.logEventStandalone.mockResolvedValue(undefined);
  mockAuditService.logEvent.mockReset();
  mockAuditService.logEvent.mockResolvedValue(undefined);
  mockNextDisplayId.mockReset();
  mockNextDisplayId.mockResolvedValue('ASSET-0001');
  mockDisplayIdService.nextDisplayIdStandalone.mockReset();
  mockDisplayIdService.nextDisplayIdStandalone.mockResolvedValue('RISK-0001');
  mockRecordCreateHistory.mockReset();
  mockRecordCreateHistory.mockResolvedValue(undefined);
  mockRecordUpdateHistory.mockReset();
  mockRecordUpdateHistory.mockResolvedValue(undefined);
  mockRecordDeleteHistory.mockReset();
  mockRecordDeleteHistory.mockResolvedValue(undefined);
  mockToHistoryData.mockReset();
  mockToHistoryData.mockImplementation((value: unknown) => value);
  mockValidateUserReferences.mockReset();
  mockValidateUserReferences.mockResolvedValue(undefined);
  mockRiskMethodService.calculateRiskScore.mockReset();
  mockCatalogService.ensureIso27001AnnexA2022Catalog.mockReset();

  assetExistingOu = OU_A;
  relationTargetOu = OU_B;
  riskEntityOu = OU_A;
});

describe('AssetService.create (scoped write gate)', () => {
  it('denies a user whose role lacks assets.write before any write', async () => {
    grantRoles(roleRow(['assets.read'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_A }, USER_ID),
      SCOPE_DENIED,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(mockNextDisplayId).not.toHaveBeenCalled();
  });

  it('denies a write into an organization unit outside the authorized scope', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_B }, USER_ID),
      SCOPE_DENIED,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets an authorized scoped write reach the transaction', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_A }, USER_ID),
    );
  });

  it('lets a role without scope constraints reach the transaction', async () => {
    grantRoles(roleRow(['assets.write']));
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_B }, USER_ID),
    );
  });

  it('characterization: an unscoped create (no OU/location) has no scope gate', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID }, USER_ID),
    );
    expect(mockPrisma.organizationUnit.findUnique).not.toHaveBeenCalled();
  });

  it('denies an unknown user (no role rows) before any write', async () => {
    grantRoles();
    await expectDenied(
      () => assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_A }, 'ghost-user'),
      SCOPE_DENIED,
    );
  });
});

describe('AssetService.update (scoped write gate on scope changes)', () => {
  it('denies moving an asset into an organization unit outside the authorized scope', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    assetExistingOu = OU_A;
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => assetService.update(ASSET_UUID, { organizationUnitId: OU_B }, USER_ID),
      SCOPE_DENIED,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets a matching scoped move reach the transaction', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_B, organizationUnitId: OU_B }));
    assetExistingOu = OU_A;
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() => assetService.update(ASSET_UUID, { organizationUnitId: OU_B }, USER_ID));
  });

  it('lets a second scoped role (union of assignments) authorize the move', async () => {
    grantRoles(
      roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }),
      roleRow(['assets.write'], { legalEntityId: LE_B, organizationUnitId: OU_B }),
    );
    assetExistingOu = OU_A;
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() => assetService.update(ASSET_UUID, { organizationUnitId: OU_B }, USER_ID));
  });

  it('characterization: clearing the organization unit skips the scope gate', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    assetExistingOu = OU_A;
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() => assetService.update(ASSET_UUID, { organizationUnitId: null as any }, USER_ID));
  });
});

describe('AssetService.createRelation (entity-scoped write gate)', () => {
  it('denies a relation whose target asset is outside the authorized scope', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    relationTargetOu = OU_B;
    const relationCreate = mockPrisma.assetRelation.create as any;

    await expectDenied(
      () => assetService.createRelation(ASSET_UUID, { targetAssetId: TARGET_ASSET_UUID, relationshipType: 'depends_on' }, USER_ID),
      'Authorization denied: assets.write required for entity or entity is outside authorized scope',
    );
    expect(relationCreate).not.toHaveBeenCalled();
  });

  it('lets an in-scope relation reach the relation write', async () => {
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    relationTargetOu = OU_A;
    (mockPrisma.assetRelation.create as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      assetService.createRelation(ASSET_UUID, { targetAssetId: TARGET_ASSET_UUID, relationshipType: 'depends_on' }, USER_ID),
    );
  });

  it('denies a relation for an unknown user before persisting', async () => {
    grantRoles();
    relationTargetOu = OU_A;
    const relationCreate = mockPrisma.assetRelation.create as any;

    await expectDenied(
      () => assetService.createRelation(ASSET_UUID, { targetAssetId: TARGET_ASSET_UUID, relationshipType: 'depends_on' }, 'ghost-user'),
      'Authorization denied: assets.write required for entity or entity is outside authorized scope',
    );
    expect(relationCreate).not.toHaveBeenCalled();
  });
});

describe('RiskService.create (scoped write gate)', () => {
  const riskPayload = {
    title: 'Scoped risk',
    description: 'Risk description',
    possibleImpact: 'Impact',
    likelihood: 3,
    impact: 3,
    assessorId: 'assessor-1',
    riskOwnerId: 'owner-1',
    nextReviewDate: new Date('2026-12-31'),
    justification: 'Justification',
  };

  it('denies a risk create into an organization unit outside the authorized scope', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    const nextDisplayId = mockDisplayIdService.nextDisplayIdStandalone as any;

    await expectDenied(
      () => riskService.create({ ...riskPayload, organizationUnitId: OU_B }, USER_ID),
      RISK_SCOPE_DENIED,
    );
    expect(nextDisplayId).not.toHaveBeenCalled();
  });

  it('lets an in-scope risk create reach the display-id allocation', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockDisplayIdService.nextDisplayIdStandalone as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() => riskService.create({ ...riskPayload, organizationUnitId: OU_A }, USER_ID));
  });

  it('denies a risk create for a user without risks.write', async () => {
    grantRoles(roleRow(['risks.read'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    const nextDisplayId = mockDisplayIdService.nextDisplayIdStandalone as any;

    await expectDenied(
      () => riskService.create({ ...riskPayload, organizationUnitId: OU_A }, USER_ID),
      RISK_SCOPE_DENIED,
    );
    expect(nextDisplayId).not.toHaveBeenCalled();
  });
});

describe('RiskService.update (entity + scope gates)', () => {
  it('denies an update when the risk entity lies outside the authorized scope', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    riskEntityOu = OU_B;
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => riskService.update(RISK_UUID, { title: 'Renamed' }, USER_ID),
      'Authorization denied: risks.write required for entity or entity is outside authorized scope',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets an in-scope entity update reach the transaction', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    riskEntityOu = OU_A;
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() => riskService.update(RISK_UUID, { title: 'Renamed' }, USER_ID));
  });

  it('denies moving the risk into an organization unit outside the authorized scope', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    riskEntityOu = OU_A;
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => riskService.update(RISK_UUID, { organizationUnitId: OU_B }, USER_ID),
      RISK_SCOPE_DENIED,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('denies an update by a user without risks.write even for an in-scope entity', async () => {
    grantRoles(roleRow(['risks.read'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    riskEntityOu = OU_A;
    const transaction = mockPrisma.$transaction as any;

    await expectDenied(
      () => riskService.update(RISK_UUID, { title: 'Renamed' }, USER_ID),
      'Authorization denied: risks.write required for entity or entity is outside authorized scope',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('ControlService.createImplementation (scoped write gate)', () => {
  const basePayload = {
    controlId: CONTROL_UUID,
    responsibleUserId: 'responsible-1',
  };

  it('denies an implementation in an organization unit outside the authorized scope', async () => {
    grantRoles(roleRow(['controls.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    const implementationCreate = mockPrisma.controlImplementation.create as any;

    await expectDenied(
      () => controlService.createImplementation({ ...basePayload, organizationUnitId: OU_B }, USER_ID),
      CONTROL_SCOPE_DENIED,
    );
    expect(implementationCreate).not.toHaveBeenCalled();
  });

  it('lets an in-scope implementation reach the persistence call', async () => {
    grantRoles(roleRow(['controls.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockPrisma.controlImplementation.create as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      controlService.createImplementation({ ...basePayload, organizationUnitId: OU_A }, USER_ID),
    );
  });

  it('denies an implementation for an unknown user before persisting', async () => {
    grantRoles();
    const implementationCreate = mockPrisma.controlImplementation.create as any;

    await expectDenied(
      () => controlService.createImplementation({ ...basePayload, organizationUnitId: OU_A }, 'ghost-user'),
      CONTROL_SCOPE_DENIED,
    );
    expect(implementationCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown control with 404 before the scope gate', async () => {
    grantRoles(roleRow(['controls.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockPrisma.control.findUnique as any).mockResolvedValue(null);

    await expectDenied(
      () => controlService.createImplementation({ ...basePayload, organizationUnitId: OU_B }, USER_ID),
      'Control not found',
      404,
    );
  });
});

describe('authorizationService scope semantics used by the write services', () => {
  it('enumerates legal-entity scope memberships for scope-constrained assignments', async () => {
    grantRoles(roleRow(['risks.write'], { legalEntityId: LE_B }));
    (mockPrisma.ismsScopeLegalEntity.findMany as any).mockResolvedValue([{ scopeId: 'scope-2' }] as any);
    riskEntityOu = OU_A;

    // Entity sits in LE_A, role is constrained to LE_B: denied.
    await expectDenied(
      () => riskService.update(RISK_UUID, { title: 'Renamed' }, USER_ID),
      'Authorization denied: risks.write required for entity or entity is outside authorized scope',
    );
    expect(mockPrisma.ismsScopeLegalEntity.findMany).toHaveBeenCalled();
  });

  it('does not consult user.isActive at the service authorization layer (characterization)', async () => {
    // `authorizationService.getUserRoles` derives grants exclusively from role
    // rows, so an inactive user with a valid role still passes the gate. This
    // suite pins the current behavior; the route-level authentication guard is
    // the only place that can reject a disabled account.
    grantRoles(roleRow(['assets.write'], { legalEntityId: LE_A, organizationUnitId: OU_A }));
    (mockPrisma.$transaction as any).mockImplementation(async () => { throw downstreamMarker; });

    await expectMarker(() =>
      assetService.create({ name: 'New asset', assetTypeId: ASSET_TYPE_UUID, organizationUnitId: OU_A }, USER_ID),
    );
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});
