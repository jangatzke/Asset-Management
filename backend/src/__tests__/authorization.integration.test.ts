const mockPrismaClient: any = {
  userRole: { findMany: jest.fn() },
  userGroup: { findMany: jest.fn() },
  risk: { findUnique: jest.fn(), count: jest.fn() },
  asset: { findUnique: jest.fn() },
  control: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  controlImplementation: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  incidentAsset: { findFirst: jest.fn() },
  ismsScopeLegalEntity: { findFirst: jest.fn(), findMany: jest.fn() },
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

import { AuthorizationService } from '../services/authorization.service';

const role = (name: string, permissions: string[], scope: Record<string, string | null> = {}, validUntil: Date | null = null, validFrom: Date | null = null) => ({
  roleName: name,
  validFrom,
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
    mockPrismaClient.ismsScopeLegalEntity.findMany.mockResolvedValue([]);
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

  describe('P0-A scoped assignment matrix', () => {
    const target = { legalEntityId: 'le-1', organizationUnitId: 'ou-1', siteId: 'site-1', scopeId: 'scope-1' };

    it.each([
      ['only LegalEntity', { legalEntityId: 'le-1' }],
      ['only OU', { organizationUnitId: 'ou-1' }],
      ['only Site', { siteId: 'site-1' }],
      ['only ISMS Scope', { scopeId: 'scope-1' }],
      ['LegalEntity+OU', { legalEntityId: 'le-1', organizationUnitId: 'ou-1' }],
      ['LegalEntity+Site', { legalEntityId: 'le-1', siteId: 'site-1' }],
      ['OU+Site', { organizationUnitId: 'ou-1', siteId: 'site-1' }],
      ['LegalEntity+OU+Site', { legalEntityId: 'le-1', organizationUnitId: 'ou-1', siteId: 'site-1' }],
      ['LegalEntity+OU+Site+ISMS Scope', target],
    ])('%s grants only when all constraints match', async (_name, scope) => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([role('risk-reader', ['risks.read'], scope)]);
      mockPrismaClient.ismsScopeLegalEntity.findMany.mockResolvedValue([{ scopeId: 'scope-1' }]);
      await expect(service.requireForScope('u1', 'risks.read', target)).resolves.toBeUndefined();
    });

    it('partially matching assignment never grants access', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([role('risk-reader', ['risks.read'], { legalEntityId: 'le-1', organizationUnitId: 'ou-other' })]);
      await expect(service.requireForScope('u1', 'risks.read', target)).rejects.toThrow('Authorization denied');
    });

    it('two assignments are ORed, while constraints within each assignment are ANDed', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        role('partial', ['risks.read'], { legalEntityId: 'le-1', organizationUnitId: 'ou-other' }),
        role('full', ['risks.read'], { legalEntityId: 'le-1', organizationUnitId: 'ou-1', siteId: 'site-1' }),
      ]);
      await expect(service.requireForScope('u1', 'risks.read', target)).resolves.toBeUndefined();
    });

    it('no assignment fully matches', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        role('partial-a', ['risks.read'], { legalEntityId: 'le-1', organizationUnitId: 'ou-other' }),
        role('partial-b', ['risks.read'], { siteId: 'site-other', scopeId: 'scope-1' }),
      ]);
      await expect(service.requireForScope('u1', 'risks.read', target)).rejects.toThrow('Authorization denied');
    });

    it('buildReadFilter emits AND within one assignment and OR between assignments', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        role('le-ou', ['risks.read'], { legalEntityId: 'le-1', organizationUnitId: 'ou-1' }),
        role('scope', ['risks.read'], { scopeId: 'scope-2' }),
      ]);
      await expect(service.buildReadFilter('u1', 'risks')).resolves.toEqual({
        OR: [
          { AND: [{ organizationUnitId: 'ou-1' }, { organizationUnit: { legalEntityId: 'le-1' } }] },
          { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: 'scope-2' } } } } },
        ],
      });
    });
  });

  describe('P0-A validity interval semantics', () => {
    it('applies validFrom and validUntil to direct role assignments', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([role('future', ['risks.read'], {}, null, new Date(Date.now() + 60_000))]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(false);

      mockPrismaClient.userRole.findMany.mockResolvedValue([role('active', ['risks.read'], {}, new Date(Date.now() + 60_000), new Date(Date.now() - 60_000))]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(true);

      mockPrismaClient.userRole.findMany.mockResolvedValue([role('expired', ['risks.read'], {}, new Date(Date.now() - 60_000), new Date(Date.now() - 120_000))]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(false);

      mockPrismaClient.userRole.findMany.mockResolvedValue([role('open', ['risks.read'], {}, null, null)]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(true);
    });

    it('applies validFrom and validUntil to group role assignments', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([{ group: { groupRoles: [role('future-group', ['risks.read'], {}, null, new Date(Date.now() + 60_000))] } }]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(false);

      mockPrismaClient.userGroup.findMany.mockResolvedValue([{ group: { groupRoles: [role('active-group', ['risks.read'], {}, new Date(Date.now() + 60_000), new Date(Date.now() - 60_000))] } }]);
      await expect(service.can('u1', 'risks.read')).resolves.toBe(true);
    });
  });

  it('supports deterministic multi-ISMS legal-entity membership checks', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('scope-a', ['risks.read'], { scopeId: 'scope-a' })]);
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-1', organizationUnitId: 'ou-1', organizationUnit: { legalEntityId: 'le-1' } });
    mockPrismaClient.ismsScopeLegalEntity.findMany.mockResolvedValue([{ scopeId: 'scope-a' }, { scopeId: 'scope-b' }]);
    await expect(service.canForEntity('u1', 'risks.read', 'risks', 'risk-1')).resolves.toBe(true);

    mockPrismaClient.userRole.findMany.mockResolvedValue([role('scope-c', ['risks.read'], { scopeId: 'scope-c' })]);
    await expect(service.canForEntity('u1', 'risks.read', 'risks', 'risk-1')).resolves.toBe(false);
  });

  it('does not authorize catalog controls by inheriting an arbitrary implementation scope', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('scoped-control-reader', ['controls.read'], { legalEntityId: 'le-1' })]);
    mockPrismaClient.controlImplementation.findUnique.mockResolvedValue(null);
    mockPrismaClient.control.findUnique.mockResolvedValue({ id: 'control-catalog' });
    await expect(service.canForEntity('u1', 'controls.read', 'controls', 'control-catalog')).resolves.toBe(false);
  });

  it('filters control implementations by authorized implementation scope', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([role('site-control-reader', ['controls.read'], { legalEntityId: 'le-1', siteId: 'site-1' })]);
    await expect(service.buildControlImplementationReadFilter('u1')).resolves.toEqual({
      OR: [{ AND: [{ OR: [{ organizationUnit: { legalEntityId: 'le-1' } }, { site: { organizationUnit: { legalEntityId: 'le-1' } } }] }, { siteId: 'site-1' }] }],
    });
  });

  it('legacy entityPermissions are not runtime grants without RolePermission rows', async () => {
    const legacyOnly = role('legacy-risk-reader', [], {});
    legacyOnly.role.entityPermissions = { risks: 'readwrite' };
    mockPrismaClient.userRole.findMany.mockResolvedValue([legacyOnly]);
    await expect(service.can('u1', 'risks.read')).resolves.toBe(false);
    await expect(service.can('u1', 'risks.write')).resolves.toBe(false);
  });

  it.each(['risks.assess', 'risks.approve', 'risks.accept', 'controls.test', 'controls.approve', 'incidents.assess', 'incidents.report', 'incidents.close', 'documents.approve'] as const)(
    'does not grant %s from broad write permission',
    async (permission) => {
      const broad = permission.split('.')[0] === 'documents' ? 'documents.write' : `${permission.split('.')[0]}.write`;
      mockPrismaClient.userRole.findMany.mockResolvedValue([role('writer', [broad])]);
      await expect(service.can('u1', permission)).resolves.toBe(false);
    },
  );
});
