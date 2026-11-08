/**
 * Batched permission evaluation: `canBatch()` must return exactly the set of
 * users for whom `can()` would return true (same active-role derivation,
 * same validity-window handling, same group-inherited roles).
 */
const mockPrismaClient: any = {
  userRole: { findMany: jest.fn() },
  userGroup: { findMany: jest.fn() },
  ismsScopeLegalEntity: { findFirst: jest.fn(), findMany: jest.fn() },
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

import { AuthorizationService } from '../services/authorization.service';

/** Assignment shape shared by UserRole and GroupRole rows (role = Role def). */
const assignment = (
  name: string,
  permissions: string[],
  validFrom: Date | null = null,
  validUntil: Date | null = null,
) => ({
  roleName: name,
  validFrom,
  validUntil,
  legalEntityId: null,
  organizationUnitId: null,
  scopeId: null,
  siteId: null,
  role: {
    canAccessAdmin: permissions.includes('administration.access'),
    entityPermissions: null,
    rolePermissions: permissions.map((permission) => ({ permission: { name: permission } })),
  },
});

/** Filter rows by the `where.userId.in` / `userId` predicate like Prisma does. */
const rowsFor = (rows: Record<string, any[]>, where: any): any[] => {
  const ids: string[] = where?.userId?.in ?? (where?.userId ? [where.userId] : []);
  return ids.flatMap((id) => (rows[id] ?? []).map((row: any) => ({ ...row, userId: id })));
};

describe('AuthorizationService.canBatch (batched workload permissions)', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthorizationService();
    mockPrismaClient.ismsScopeLegalEntity.findFirst.mockResolvedValue(null);
    mockPrismaClient.ismsScopeLegalEntity.findMany.mockResolvedValue([]);
    mockPrismaClient.userGroup.findMany.mockResolvedValue([]);
    mockPrismaClient.userRole.findMany.mockResolvedValue([]);
  });

  it('returns the same set as per-user can() for mixed direct assignments', async () => {
    mockPrismaClient.userRole.findMany.mockImplementation(async ({ where }: any) =>
      rowsFor({
        u1: [assignment('writer', ['tickets.write'])],
        u2: [assignment('reader', ['tickets.read'])],
        u3: [assignment('writer', ['tickets.write'])],
      }, where),
    );

    const users = ['u1', 'u2', 'u3'];
    const batch = await service.canBatch(users, 'tickets.write');
    const expected = new Set<string>();
    for (const id of users) {
      if (await service.can(id, 'tickets.write')) expected.add(id);
    }

    expect(batch).toEqual(expected);
    expect(batch).toEqual(new Set(['u1', 'u3']));
  });

  it('honours validity windows identically to can()', async () => {
    const past = new Date('2025-01-01T00:00:00Z');
    const future = new Date('2030-01-01T00:00:00Z');
    mockPrismaClient.userRole.findMany.mockImplementation(async ({ where }: any) =>
      rowsFor({
        active: [assignment('writer', ['tickets.write'], past, future)],
        expired: [assignment('writer', ['tickets.write'], past, past)],
      }, where),
    );

    const batch = await service.canBatch(['active', 'expired'], 'tickets.write');
    expect(batch).toEqual(new Set(['active']));
    await expect(service.can('expired', 'tickets.write')).resolves.toBe(false);
    await expect(service.can('active', 'tickets.write')).resolves.toBe(true);
  });

  it('includes group-inherited roles like getUserRoles()/can()', async () => {
    mockPrismaClient.userRole.findMany.mockResolvedValue([]);
    mockPrismaClient.userGroup.findMany.mockImplementation(async ({ where }: any) => {
      const ids: string[] = where?.userId?.in ?? [];
      return ids
        .filter((id) => id === 'g1')
        .map(() => ({
          userId: 'g1',
          group: { groupRoles: [assignment('grp-writer', ['tickets.write'])] },
        }));
    });

    const batch = await service.canBatch(['g1', 'plain'], 'tickets.write');
    expect(batch.has('g1')).toBe(true);
    expect(batch.has('plain')).toBe(false);
  });

  it('short-circuits: no query for an empty user list', async () => {
    const result = await service.canBatch([], 'tickets.write');
    expect(result.size).toBe(0);
    expect(mockPrismaClient.userRole.findMany).not.toHaveBeenCalled();
    expect(mockPrismaClient.userGroup.findMany).not.toHaveBeenCalled();
  });
});
