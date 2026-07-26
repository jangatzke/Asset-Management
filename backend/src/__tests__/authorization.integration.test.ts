const mockPrismaClient: any = {
  userRole: { findMany: jest.fn() },
  userGroup: { findMany: jest.fn() },
  risk: { findUnique: jest.fn(), count: jest.fn() },
  asset: { findUnique: jest.fn() },
  controlImplementation: { findFirst: jest.fn() },
  incidentAsset: { findFirst: jest.fn() },
  ismsScopeLegalEntity: { findFirst: jest.fn() },
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

import { AuthorizationService } from '../services/authorization.service';

const role = (name: string, permissions: string[], scope: Record<string, string | null> = {}, validUntil: Date | null = null) => ({
  roleName: name,
  validUntil,
  legalEntityId: scope.legalEntityId ?? null,
  organizationUnitId: scope.organizationUnitId ?? null,
  scopeId: scope.scopeId ?? null,
  siteId: scope.siteId ?? null,
  role: {
    canAccessAdmin: permissions.includes('administration.access'),
    entityPermissions: null,
    rolePermissions: permissions.map((permission) => ({ permission: { name: permission } })),
  },
});

describe('AuthorizationService Phase 1 granular scoped authorization', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthorizationService();
    mockPrismaClient.userGroup.findMany.mockResolvedValue([]);
    mockPrismaClient.ismsScopeLegalEntity.findFirst.mockResolvedValue(null);
  });

  it('user without risks.read sees no risks', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('asset-reader', ['assets.read'])]);
    await expect(service.can('u1', 'risks.read')).resolves.toBe(false);
    await expect(service.buildReadFilter('u1', 'risks')).resolves.toEqual({ id: { equals: '__phase1_no_permission__' } });
  });

  it('risk read-only can read but not write', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('risk-reader', ['risks.read'])]);
    await expect(service.can('u1', 'risks.read')).resolves.toBe(true);
    await expect(service.can('u1', 'risks.write')).resolves.toBe(false);
  });

  it('asset write cannot modify suppliers', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('asset-writer', ['assets.read', 'assets.write'])]);
    await expect(service.can('u1', 'assets.write')).resolves.toBe(true);
    await expect(service.can('u1', 'suppliers.write')).resolves.toBe(false);
  });

  it('IT-scoped user cannot see production risk', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('it-risk-reader', ['risks.read'], { organizationUnitId: 'ou-it' })]);
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-prod', organizationUnitId: 'ou-prod', organizationUnit: { legalEntityId: 'le-prod' } });
    await expect(service.canForEntity('u1', 'risks.read', 'risks', 'risk-prod')).resolves.toBe(false);
  });

  it('IT-scoped user cannot create production risk', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('it-risk-writer', ['risks.write'], { organizationUnitId: 'ou-it' })]);
    await expect(service.requireForScope('u1', 'risks.write', { organizationUnitId: 'ou-prod', legalEntityId: 'le-prod', scopeId: null, siteId: null })).rejects.toThrow('Authorization denied');
  });

  it('multiple scoped roles result in union access', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([
      role('it-risk-reader', ['risks.read'], { organizationUnitId: 'ou-it' }),
      role('prod-risk-reader', ['risks.read'], { organizationUnitId: 'ou-prod' }),
    ]);
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-prod', organizationUnitId: 'ou-prod', organizationUnit: { legalEntityId: 'le-prod' } });
    await expect(service.canForEntity('u1', 'risks.read', 'risks', 'risk-prod')).resolves.toBe(true);
  });

  it('expired role assignment is ineffective', async () => {
    const expired = new Date(Date.now() - 60_000);
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('expired-risk-writer', ['risks.write'], {}, expired)]);
    await expect(service.can('u1', 'risks.write')).resolves.toBe(false);
  });

  it('group-based roles work', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([]);
    mockPrismaClient.userGroup.findMany.mockResolvedValue([{ group: { groupRoles: [role('group-risk-reader', ['risks.read'])] } }]);
    await expect(service.can('u1', 'risks.read')).resolves.toBe(true);
  });

  it('unrestricted admin role works', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('system_admin', ['administration.access'])]);
    await expect(service.can('admin', 'suppliers.approve')).resolves.toBe(true);
    await expect(service.canAccessAdmin('admin')).resolves.toBe(true);
  });

  it('list filters prevent pagination/count leakage', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('it-risk-reader', ['risks.read'], { organizationUnitId: 'ou-it' })]);
    await expect(service.buildReadFilter('u1', 'risks')).resolves.toEqual({ OR: [{ organizationUnitId: 'ou-it' }] });
  });

  it('detail endpoint outside scope uses documented 403 behavior', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('it-risk-reader', ['risks.read'], { organizationUnitId: 'ou-it' })]);
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-prod', organizationUnitId: 'ou-prod', organizationUnit: { legalEntityId: 'le-prod' } });
    await expect(service.requireForEntity('u1', 'risks.read', 'risks', 'risk-prod')).rejects.toThrow('Authorization denied');
  });

  it('search endpoints respect the same rights through buildReadFilter', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('risk-reader', ['risks.read'], { legalEntityId: 'le-1' })]);
    await expect(service.buildReadFilter('u1', 'risks')).resolves.toEqual({ OR: [{ organizationUnit: { legalEntityId: 'le-1' } }] });
  });
});
