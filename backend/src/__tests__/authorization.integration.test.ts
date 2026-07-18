/**
 * Authorization Integration Tests
 *
 * Tests for Paket 1.1 - Zugriffskontrolle (P0-01, P0-02):
 * - Admin access protection via role.canAccessAdmin from database
 * - Entity-level authorization (assets, risks, controls, incidents)
 * - Role expiry validation (expired roles are ineffective)
 * - Read-only role cannot modify entities
 * - Employee gets 403 on admin routes
 */

// ---- Mock Prisma Client (must be before imports) ----

const mockPrismaClient: any = {
  userRole: {
    findMany: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { AuthorizationService } from '../services/authorization.service';
import { AppError } from '../middleware/errorHandler';

describe('AuthorizationService - Integration Tests', () => {
  let authorizationService: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    authorizationService = new AuthorizationService();
  });

  // ==========================================
  // P0-01: Administrationsschutz
  // ==========================================

  describe('P0-01: Admin Access Protection', () => {

    it('should allow admin access when role.canAccessAdmin is true from DB', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('admin-user-123');

      expect(result).toBe(true);
    });

    it('should deny admin access when role.canAccessAdmin is false from DB', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('employee-user-123');

      expect(result).toBe(false);
    });

    it('should deny admin access for employee role (403 expected)', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      await expect(
        authorizationService.requireAdminAccess('employee-user-123')
      ).rejects.toThrow('Administration access required');
    });

    it('should allow admin access when ANY role has canAccessAdmin=true', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: null,
          },
        },
        {
          roleName: 'security_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: { risks: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('multi-role-user');

      expect(result).toBe(true);
    });

    it('should deny admin access when role is expired (validUntil in past)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: pastDate,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('expired-admin-user');

      expect(result).toBe(false);
    });

    it('should allow admin access when role expires in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: futureDate,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: null,
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('valid-admin-user');

      expect(result).toBe(true);
    });

    it('should allow admin access when role has no expiry (validUntil is null)', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: null,
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('permanent-admin-user');

      expect(result).toBe(true);
    });

    it('should deny admin access when user has no roles', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canAccessAdmin('no-role-user');

      expect(result).toBe(false);
    });

    it('should grant admin access via group-assigned roles', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([
        {
          userId: 'group-user-123',
          group: {
            groupRoles: [
              {
                roleName: 'system_admin',
                role: {
                  canAccessAdmin: true,
                  entityPermissions: null,
                },
              },
            ],
          },
        },
      ]);

      const result = await authorizationService.canAccessAdmin('group-user-123');

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // P0-02: Entity Authorization
  // ==========================================

  describe('P0-02: Entity-Level Authorization', () => {

    it('should allow read access for readonly permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'employee-user',
        'assets',
        'read'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny write access for readonly permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'employee-user',
        'assets',
        'write'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient permission');
    });

    it('should deny delete access for readonly permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'employee-user',
        'assets',
        'delete'
      );

      expect(result.allowed).toBe(false);
    });

    it('should allow write access for readwrite permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'admin-user',
        'assets',
        'write'
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow delete access for readwrite permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'admin-user',
        'assets',
        'delete'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny all access for "none" permission level', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'auditor',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'none' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const readResult = await authorizationService.checkEntityPermission(
        'auditor-user',
        'assets',
        'read'
      );
      expect(readResult.allowed).toBe(false);

      const writeResult = await authorizationService.checkEntityPermission(
        'auditor-user',
        'assets',
        'write'
      );
      expect(writeResult.allowed).toBe(false);
    });

    it('should aggregate permissions from multiple roles (max wins)', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
        {
          roleName: 'asset_manager',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'multi-role-user',
        'assets',
        'write'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny access when expired role is the only one granting permission', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
        {
          roleName: 'asset_manager',
          validUntil: pastDate, // Expired!
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      // Write should fail because asset_manager is expired
      const writeResult = await authorizationService.checkEntityPermission(
        'expired-role-user',
        'assets',
        'write'
      );
      expect(writeResult.allowed).toBe(false);

      // Read should still work via employee role
      const readResult = await authorizationService.checkEntityPermission(
        'expired-role-user',
        'assets',
        'read'
      );
      expect(readResult.allowed).toBe(true);
    });

    it('should deny access when user has no active roles', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'no-role-user',
        'assets',
        'read'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No active roles');
    });

    it('should throw error when requireEntityPermission fails', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      await expect(
        authorizationService.requireEntityPermission('employee-user', 'assets', 'write')
      ).rejects.toThrow('Authorization denied');
    });

    it('should check entity permissions for risks entity type', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'risk_analyst',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { risks: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'analyst-user',
        'risks',
        'write'
      );

      expect(result.allowed).toBe(true);
    });

    it('should check entity permissions for controls entity type', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'compliance_officer',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { controls: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'compliance-user',
        'controls',
        'delete'
      );

      expect(result.allowed).toBe(true);
    });

    it('should check entity permissions for incidents entity type', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'incident_manager',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { incidents: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'incident-user',
        'incidents',
        'write'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny cross-entity write (risk role cannot modify assets)', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'risk_analyst',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { risks: 'readwrite', assets: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.checkEntityPermission(
        'analyst-user',
        'assets',
        'write'
      );

      expect(result.allowed).toBe(false);
    });
  });

  // ==========================================
  // canPerformWriteAction Tests
  // ==========================================

  describe('canPerformWriteAction', () => {

    it('should return true if any entity has readwrite permission', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'risk_analyst',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { risks: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canPerformWriteAction('analyst-user');

      expect(result).toBe(true);
    });

    it('should return false if only readonly permissions exist', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'employee',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readonly', risks: 'readonly' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canPerformWriteAction('employee-user');

      expect(result).toBe(false);
    });

    it('should return true for admin even without entity permissions', async () => {
      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'system_admin',
          validUntil: null,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: true,
            entityPermissions: null,
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canPerformWriteAction('admin-user');

      expect(result).toBe(true);
    });

    it('should return false when role is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      mockPrismaClient.userRole.findMany.mockResolvedValue([
        {
          roleName: 'asset_manager',
          validUntil: pastDate,
          scopeId: null,
          organizationUnitId: null,
          role: {
            canAccessAdmin: false,
            entityPermissions: { assets: 'readwrite' },
          },
        },
      ]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authorizationService.canPerformWriteAction('expired-user');

      expect(result).toBe(false);
    });
  });
});
