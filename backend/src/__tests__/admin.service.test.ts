/**
 * Tests for AdminService
 *
 * Tests user management, role management, group management,
 * and asset type management functionality.
 */

import bcrypt from 'bcryptjs';

// Using any type for mocks to avoid strict TypeScript 'never' inference issues
const mockPrismaClient: any = {
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null), // Phase 9: hash-chain previous entry lookup
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  group: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  groupRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  assetType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  asset: {
    count: jest.fn(),
  },
  oidcConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  authSettings: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  intuneAppCredentials: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

// Mock oidc service
jest.mock('../services/oidc.service', () => ({
  oidcService: {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    isLocalLoginEnabled: jest.fn(),
    handleCallback: jest.fn(),
  },
}));

import { AdminService } from '../services/admin.service';
import { AppError } from '../middleware/errorHandler';
import { testUser, testAdminUser, testUserRole, testGroup, testUserGroup, testGroupRole, testRole, testAdminRole, testAssetType, testOidcConfig } from '../test/fixtures';
import { oidcService } from '../services/oidc.service';

describe('AdminService', () => {
  let adminService: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    adminService = new AdminService();
    mockPrismaClient.authSettings.findFirst.mockResolvedValue({
      id: 'auth-settings-1',
      passwordComplexityEnabled: true,
      minPasswordLength: 12,
      passwordHistoryCount: 0,
      passwordValidityDays: 0,
      forceMfa: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaClient.passwordHistory.findMany.mockResolvedValue([]);
  });

  describe('listUsers', () => {
    it('should return a list of users with roles and groups', async () => {
      const users = [
        {
          ...testUser,
          userRoles: [testUserRole],
          userGroups: [{ ...testUserGroup, group: { ...testGroup, groupRoles: [] } }],
        },
      ];

      mockPrismaClient.user.findMany.mockResolvedValue(users);

      const result = await adminService.listUsers();

      expect(result.length).toBe(1);
      expect(result[0].email).toBe(testUser.email);
      expect(result[0].roles).toContain('employee');
    });

    it('should return empty array if no users exist', async () => {
      mockPrismaClient.user.findMany.mockResolvedValue([]);

      const result = await adminService.listUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const user = {
        ...testUser,
        userRoles: [testUserRole],
        userGroups: [{ ...testUserGroup, group: { ...testGroup, groupRoles: [] } }],
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      const result = await adminService.getUserById(testUser.id);

      expect(result?.email).toBe(testUser.email);
      expect(result?.roles).toContain('employee');
    });

    it('should return null if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await adminService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a new user with default role', async () => {
      const userData: any = {
        email: 'newuser@example.com',
        password: 'Str0ng!Password',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+491234567890',
      };

      // findUnique called 3x: 1st for email check, 2nd for admin name lookup, 3rd after create to get full user
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...testUser,
          firstName: 'Admin',
          lastName: 'User',
        })
        .mockResolvedValueOnce({
          ...testUser,
          id: 'new-user-id',
          email: 'newuser@example.com',
          userRoles: [],
          userGroups: [],
        });
      mockPrismaClient.user.create.mockResolvedValue({
        ...testUser,
        email: 'newuser@example.com',
        userRoles: [],
        userGroups: [],
      });
      mockPrismaClient.userRole.create.mockResolvedValue(testUserRole);
      mockPrismaClient.userRole.create.mockResolvedValue(testUserRole);

      const result = await adminService.createUser(userData, 'admin-id');

      expect(result.email).toBe('newuser@example.com');
      expect(mockPrismaClient.user.create).toHaveBeenCalled();
    });

    it('should throw an error if email already exists', async () => {
      const userData: any = {
        email: testUser.email,
        password: 'Str0ng!Password',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+491234567890',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      await expect(adminService.createUser(userData, 'admin-id')).rejects.toThrow(AppError);
      await expect(adminService.createUser(userData, 'admin-id')).rejects.toThrow('Email already registered');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'User',
        phoneNumber: '+49999999999',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...testUser,
        userGroups: [],
      });
      mockPrismaClient.user.update.mockResolvedValue({
        ...testUser,
        ...updateData,
        userGroups: [],
      });

      const result = await adminService.updateUser(testUser.id, updateData, 'admin-id');

      expect(result.firstName).toBe('Updated');
      expect(mockPrismaClient.user.update).toHaveBeenCalled();
    });

    it('should throw an error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(adminService.updateUser('nonexistent', {}, 'admin-id')).rejects.toThrow(AppError);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.userGroup.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.user.delete.mockResolvedValue(testUser);

      const result = await adminService.deleteUser(testUser.id);

      expect(result).toEqual({ message: 'User deleted successfully' });
      expect(mockPrismaClient.user.delete).toHaveBeenCalled();
    });

    it('should throw an error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(adminService.deleteUser('nonexistent')).rejects.toThrow(AppError);
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to user', async () => {
      const assignRolesData = {
        roles: ['system_admin'],
      };

      // 1st call: findUnique before deleteMany
      mockPrismaClient.user.findUnique.mockResolvedValueOnce({
        ...testUser,
        userRoles: [],
        userGroups: [],
      });
      // Get current roles for audit log (empty since no existing roles)
      mockPrismaClient.userRole.findMany.mockResolvedValue([]);
      mockPrismaClient.userRole.deleteMany.mockResolvedValue({ count: 0 });
      // Create a mock role with roleName 'system_admin' for the second create call
      const systemAdminRole = {
        ...testUserRole,
        id: 'ur-system-admin',
        roleName: 'system_admin',
      };
      mockPrismaClient.userRole.create.mockResolvedValue(systemAdminRole);
      // 2nd call: findUnique after create to get the user with new role
      mockPrismaClient.user.findUnique.mockResolvedValueOnce({
        ...testUser,
        userRoles: [systemAdminRole],
        userGroups: [],
      });

      const result = await adminService.assignRoles(testUser.id, assignRolesData);

      expect(result.roles).toContain('system_admin');
    });
  });

  describe('getAvailableRoles', () => {
    it('should return available roles including built-in', async () => {
      mockPrismaClient.role.findMany.mockResolvedValue([testRole, testAdminRole]);

      const result = await adminService.getAvailableRoles();

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('employee');
    });
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const roleData: any = {
        name: 'custom_role',
        description: 'Custom role',
        permissions: [{ assetType: 'assets', level: 'read' }],
        canAccessAdmin: false,
        entityPermissions: { assets: 'none', risks: 'none', controls: 'none', incidents: 'none' },
      };

      mockPrismaClient.role.findUnique.mockResolvedValue(null);
      mockPrismaClient.role.create.mockResolvedValue({
        ...roleData,
        id: 'role-new',
        isBuiltIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await adminService.createRole(roleData);

      expect(result.name).toBe('custom_role');
    });

    it('should throw an error if role name already exists', async () => {
      const roleData: any = {
        name: testRole.name,
        description: 'Duplicate',
        permissions: [],
        canAccessAdmin: false,
        entityPermissions: { assets: 'none' as const, risks: 'none' as const, controls: 'none' as const, incidents: 'none' as const },
      };

      mockPrismaClient.role.findUnique.mockResolvedValue(testRole);

      await expect(adminService.createRole(roleData)).rejects.toThrow(AppError);
      await expect(adminService.createRole(roleData)).rejects.toThrow('Role with this name already exists');
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      const updateData = {
        name: 'updated_role',
        description: 'Updated description',
      };

      // Use a non-built-in role for the update test
      const nonBuiltInRole = {
        ...testRole,
        id: 'role-custom',
        isBuiltIn: false,
      };
      mockPrismaClient.role.findUnique.mockResolvedValueOnce(nonBuiltInRole);
      mockPrismaClient.role.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.role.update.mockResolvedValue({
        ...nonBuiltInRole,
        ...updateData,
      });

      const result = await adminService.updateRole(nonBuiltInRole.id, updateData);

      expect(result.name).toBe('updated_role');
    });

    it('should throw an error for built-in roles', async () => {
      await expect(adminService.updateRole(testRole.id, { name: 'new_name' } as any)).rejects.toThrow('Built-in roles cannot be modified');
    });

    it('should throw an error if role not found', async () => {
      mockPrismaClient.role.findUnique.mockResolvedValue(null);

      await expect(adminService.updateRole('nonexistent', {} as any)).rejects.toThrow('Role not found');
    });
  });

  describe('deleteRole', () => {
    it('should delete role successfully', async () => {
      // Use a non-built-in role for the delete test
      const nonBuiltInRole = {
        ...testRole,
        id: 'role-custom',
        isBuiltIn: false,
      };
      mockPrismaClient.role.findUnique.mockResolvedValueOnce(nonBuiltInRole);
      mockPrismaClient.userRole.count.mockResolvedValue(0);
      mockPrismaClient.groupRole.count.mockResolvedValue(0);
      mockPrismaClient.role.delete.mockResolvedValue(nonBuiltInRole);

      const result = await adminService.deleteRole(nonBuiltInRole.id);

      expect(result.message).toBe('Role deleted successfully');
    });

    it('should throw an error for built-in roles', async () => {
      mockPrismaClient.role.findUnique.mockResolvedValue({
        ...testRole,
        isBuiltIn: true,
      });
      await expect(adminService.deleteRole(testRole.id)).rejects.toThrow('Built-in roles cannot be deleted');
    });

    it('should throw an error if role is assigned to users', async () => {
      mockPrismaClient.role.findUnique.mockResolvedValue({
        ...testRole,
        id: 'role-assigned',
        isBuiltIn: false,
      });
      mockPrismaClient.userRole.count.mockResolvedValue(1);
      mockPrismaClient.groupRole.count.mockResolvedValue(0);

      await expect(adminService.deleteRole('assigned-role')).rejects.toThrow('Cannot delete role that is assigned to users or groups');
    });
  });

  describe('initializeBuiltInRoles', () => {
    it('should create built-in roles if they do not exist', async () => {
      // All findUnique calls return null (role doesn't exist)
      mockPrismaClient.role.findUnique.mockResolvedValue(null);

      await adminService.initializeBuiltInRoles();

      expect(mockPrismaClient.role.create).toHaveBeenCalled();
    });

    it('should skip built-in roles that already exist', async () => {
      // All findUnique calls return the role (role exists)
      mockPrismaClient.role.findUnique.mockResolvedValue(testRole);

      await adminService.initializeBuiltInRoles();

      expect(mockPrismaClient.role.create).not.toHaveBeenCalled();
    });
  });

  describe('listGroups', () => {
    it('should return a list of groups', async () => {
      mockPrismaClient.group.findMany.mockResolvedValue([testGroup]);

      const result = await adminService.listGroups();

      expect(result.length).toBe(1);
      expect(result[0].name).toBe(testGroup.name);
    });
  });

  describe('createGroup', () => {
    it('should create a new group', async () => {
      const groupData = {
        name: 'New Group',
        description: 'Test group',
      };

      mockPrismaClient.group.findUnique.mockResolvedValue(null);
      mockPrismaClient.group.create.mockResolvedValue({
        ...groupData,
        id: 'group-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await adminService.createGroup(groupData);

      expect(result.name).toBe('New Group');
    });

    it('should throw an error if group name already exists', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(testGroup);

      await expect(adminService.createGroup({ name: testGroup.name, description: 'dup' })).rejects.toThrow();
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully', async () => {
      const updateData = { name: 'Updated Group' };

      // First findUnique returns the existing group
      mockPrismaClient.group.findUnique.mockResolvedValueOnce(testGroup);
      // Second findUnique for duplicate check returns null (no duplicate)
      mockPrismaClient.group.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.group.update.mockResolvedValue({ ...testGroup, ...updateData });

      const result = await adminService.updateGroup(testGroup.id, updateData);

      expect(result.name).toBe('Updated Group');
    });

    it('should throw an error if group not found', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(null);

      await expect(adminService.updateGroup('nonexistent', {} as any)).rejects.toThrow('Group not found');
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(testGroup);
      mockPrismaClient.userGroup.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.groupRole.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.group.delete.mockResolvedValue(testGroup);

      const result = await adminService.deleteGroup(testGroup.id);

      expect(result.message).toBe('Group deleted successfully');
    });

    it('should throw an error if group not found', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(null);

      await expect(adminService.deleteGroup('nonexistent')).rejects.toThrow(AppError);
    });
  });

  describe('assignUsersToGroup', () => {
    it('should assign users to group', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(testGroup);
      // findUnique is called for each user in userIds
      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...testUser,
        userRoles: [],
        userGroups: [],
      });
      mockPrismaClient.userGroup.create.mockResolvedValue(testUserGroup);

      await adminService.assignUsersToGroup(testGroup.id, { userIds: ['user-1'] });

      expect(mockPrismaClient.userGroup.create).toHaveBeenCalled();
    });

    it('should throw an error if group not found', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(null);

      await expect(adminService.assignUsersToGroup('nonexistent', { userIds: ['user-1'] })).rejects.toThrow();
    });
  });

  describe('assignRolesToGroup', () => {
    it('should assign roles to group', async () => {
      mockPrismaClient.group.findUnique.mockResolvedValue(testGroup);
      mockPrismaClient.groupRole.create.mockResolvedValue(testGroupRole);

      await adminService.assignRolesToGroup(testGroup.id, { roles: ['employee'] as any });

      expect(mockPrismaClient.groupRole.create).toHaveBeenCalled();
    });
  });

  describe('listAssetTypes', () => {
    it('should return a list of asset types', async () => {
      mockPrismaClient.assetType.findMany.mockResolvedValue([testAssetType]);

      const result = await adminService.listAssetTypes();

      expect(result.length).toBe(1);
    });
  });

  describe('createAssetType', () => {
    it('should create a new asset type', async () => {
      const typeData: any = {
        name: 'New Type',
        description: 'Test type',
        category: 'hardware',
      };

      mockPrismaClient.assetType.findUnique.mockResolvedValue(null);
      mockPrismaClient.assetType.create.mockResolvedValue({
        ...typeData,
        id: 'type-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await adminService.createAssetType(typeData);

      expect(result.name).toBe('New Type');
    });

    it('should throw an error if asset type name already exists', async () => {
      mockPrismaClient.assetType.findUnique.mockResolvedValue(testAssetType);

      await expect(adminService.createAssetType({ name: testAssetType.name, description: '', category: 'hardware' })).rejects.toThrow();
    });
  });

  describe('updateAssetType', () => {
    it('should update asset type successfully', async () => {
      const updateData = { name: 'Updated Type' };

      // First findUnique returns the existing asset type
      mockPrismaClient.assetType.findUnique.mockResolvedValueOnce(testAssetType);
      // Second findUnique for duplicate check returns null (no duplicate)
      mockPrismaClient.assetType.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.assetType.update.mockResolvedValue({ ...testAssetType, ...updateData });

      const result = await adminService.updateAssetType(testAssetType.id, updateData);

      expect(result.name).toBe('Updated Type');
    });
  });

  describe('deleteAssetType', () => {
    it('should delete asset type successfully', async () => {
      mockPrismaClient.assetType.findUnique.mockResolvedValue(testAssetType);
      mockPrismaClient.asset.count.mockResolvedValue(0);
      mockPrismaClient.assetType.delete.mockResolvedValue(testAssetType);

      const result = await adminService.deleteAssetType(testAssetType.id);

      expect(result.message).toBe('Asset type deleted successfully');
    });

    it('should throw an error if asset type has associated assets', async () => {
      mockPrismaClient.assetType.findUnique.mockResolvedValue(testAssetType);
      mockPrismaClient.asset.count.mockResolvedValue(1);

      await expect(adminService.deleteAssetType('has-assets')).rejects.toThrow('Cannot delete asset type with associated assets');
    });
  });

  describe('archiveAssetType', () => {
    it('should archive asset type successfully', async () => {
      mockPrismaClient.assetType.findUnique.mockResolvedValue(testAssetType);
      mockPrismaClient.assetType.update.mockResolvedValue({ ...testAssetType, isArchived: true });

      const result = await adminService.archiveAssetType(testAssetType.id);

      expect(result.isArchived).toBe(true);
    });

    it('should throw an error if asset type not found', async () => {
      mockPrismaClient.assetType.findUnique.mockResolvedValue(null);

      await expect(adminService.archiveAssetType('nonexistent')).rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      await adminService.changePassword(testUser.id, 'Str0ng!NewPass', 'admin-id');

      expect(mockPrismaClient.user.update).toHaveBeenCalled();
    });

    it('should throw an error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(adminService.changePassword('nonexistent', 'Str0ng!NewPass', 'admin-id')).rejects.toThrow(AppError);
    });

    it('should reject weak passwords during password change', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      await expect(adminService.changePassword(testUser.id, 'weak', 'admin-id')).rejects.toThrow(
        AppError
      );
      await expect(adminService.changePassword(testUser.id, 'weak', 'admin-id')).rejects.toThrow(
        'Password does not meet security requirements'
      );
    });
  });

  describe('Intune App Credentials', () => {
    describe('getIntuneCredentials', () => {
      it('should return credentials when they exist', async () => {
        const mockCreds = {
          id: 'cred-123',
          name: 'Intune API Credentials',
          tenantId: 'tenant-123',
          appId: 'app-123',
          clientSecret: 'secret',
          clientSecretExpiresAt: null,
          certificateThumbprint: null,
          isConfigured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue(mockCreds);

        const result = await adminService.getIntuneCredentials();

        expect(result).toBeDefined();
        expect(result!.name).toBe('Intune API Credentials');
        expect(result!.isConfigured).toBe(true);
      });

      it('should return null when no credentials exist', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue(null);

        const result = await adminService.getIntuneCredentials();

        expect(result).toBeNull();
      });
    });

    describe('createIntuneCredentials', () => {
      it('should create credentials when none exist', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue(null);
        const created = {
          id: 'cred-new',
          name: 'Test Credentials',
          tenantId: 'tenant-456',
          appId: 'app-456',
          clientSecret: 'secret123',
          clientSecretExpiresAt: null,
          certificateThumbprint: null,
          isConfigured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPrismaClient.intuneAppCredentials.create.mockResolvedValue(created);

        const result = await adminService.createIntuneCredentials({
          name: 'Test Credentials',
          tenantId: 'tenant-456',
          appId: 'app-456',
          clientSecret: 'secret123',
        });

        expect(result.name).toBe('Test Credentials');
        expect(result.isConfigured).toBe(true);
      });

      it('should throw error when credentials already exist', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue({ id: 'cred-123' });

        await expect(
          adminService.createIntuneCredentials({ name: 'Duplicate' })
        ).rejects.toThrow(AppError);
      });
    });

    describe('updateIntuneCredentials', () => {
      it('should update existing credentials', async () => {
        const existing = {
          id: 'cred-123',
          name: 'Intune API Credentials',
          tenantId: 'tenant-123',
          appId: 'app-123',
          clientSecret: 'old-secret',
          clientSecretExpiresAt: null,
          certificateThumbprint: null,
          isConfigured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValueOnce(existing);

        const updated = { ...existing, clientSecret: 'new-secret', isConfigured: true };
        mockPrismaClient.intuneAppCredentials.update.mockResolvedValue(updated);

        const result = await adminService.updateIntuneCredentials({
          clientSecret: 'new-secret',
        });

        expect(result!.isConfigured).toBe(true);
      });

      it('should throw error when no credentials exist', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue(null);

        await expect(
          adminService.updateIntuneCredentials({ name: 'New Name' })
        ).rejects.toThrow(AppError);
      });
    });

    describe('deleteIntuneCredentials', () => {
      it('should delete existing credentials', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue({ id: 'cred-123' });
        mockPrismaClient.intuneAppCredentials.delete.mockResolvedValue({ id: 'cred-123' });

        const result = await adminService.deleteIntuneCredentials();

        expect(result.message).toBe('Intune app credentials deleted successfully');
      });

      it('should throw error when no credentials exist', async () => {
        mockPrismaClient.intuneAppCredentials.findFirst.mockResolvedValue(null);

        await expect(adminService.deleteIntuneCredentials()).rejects.toThrow(AppError);
      });
    });
  });

  // ==========================================
  // Authorization Tests (Paket 1.1 - P0-01, P0-02)
  // ==========================================

  describe('Role-based Authorization', () => {
    describe('createRole with canAccessAdmin', () => {
      it('should create role with canAccessAdmin=true', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue(null);
        mockPrismaClient.role.create.mockResolvedValue({
          id: 'new-role',
          name: 'security_admin',
          description: 'Security administrator',
          isBuiltIn: false,
          permissions: [],
          canAccessAdmin: true,
          entityPermissions: { risks: 'readwrite', controls: 'readwrite' },
        });

        const result = await adminService.createRole({
          name: 'security_admin',
          description: 'Security administrator',
          permissions: [],
          canAccessAdmin: true,
          entityPermissions: { risks: 'readwrite', controls: 'readwrite' },
        });

        expect(result.canAccessAdmin).toBe(true);
        expect(result.entityPermissions.risks).toBe('readwrite');
      });

      it('should create role with canAccessAdmin=false by default', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue(null);
        mockPrismaClient.role.create.mockResolvedValue({
          id: 'new-role',
          name: 'viewer',
          description: 'Read-only viewer',
          isBuiltIn: false,
          permissions: [],
          canAccessAdmin: false,
          entityPermissions: { assets: 'readonly' },
        });

        const result = await adminService.createRole({
          name: 'viewer',
          permissions: [],
          entityPermissions: { assets: 'readonly' },
        });

        expect(result.canAccessAdmin).toBe(false);
      });
    });

    describe('updateRole canAccessAdmin', () => {
      it('should update canAccessAdmin flag on custom role', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue({
          id: 'role-123',
          name: 'custom_role',
          isBuiltIn: false,
          canAccessAdmin: false,
        });
        mockPrismaClient.role.update.mockResolvedValue({
          id: 'role-123',
          name: 'custom_role',
          isBuiltIn: false,
          canAccessAdmin: true,
        });

        const result = await adminService.updateRole('role-123', {
          canAccessAdmin: true,
        });

        expect(result.canAccessAdmin).toBe(true);
      });

      it('should prevent modifying built-in roles', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue({
          id: 'role-123',
          name: 'system_admin',
          isBuiltIn: true,
        });

        await expect(
          adminService.updateRole('role-123', { canAccessAdmin: false })
        ).rejects.toThrow('Built-in roles cannot be modified');
      });
    });

    describe('initializeBuiltInRoles', () => {
      it('should create system_admin with canAccessAdmin=true', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue(null);
        mockPrismaClient.role.create.mockResolvedValue({
          id: 'builtin-admin',
          name: 'system_admin',
          canAccessAdmin: true,
          isBuiltIn: true,
        });

        await adminService.initializeBuiltInRoles();

        expect(mockPrismaClient.role.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'system_admin',
              canAccessAdmin: true,
            }),
          })
        );
      });

      it('should create employee with canAccessAdmin=false', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue(null);
        mockPrismaClient.role.create.mockResolvedValue({
          id: 'builtin-employee',
          name: 'employee',
          canAccessAdmin: false,
          isBuiltIn: true,
        });

        await adminService.initializeBuiltInRoles();

        expect(mockPrismaClient.role.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'employee',
              canAccessAdmin: false,
            }),
          })
        );
      });

      it('should skip built-in roles that already exist', async () => {
        mockPrismaClient.role.findUnique.mockResolvedValue({
          id: 'existing',
          name: 'system_admin',
          canAccessAdmin: true,
        });

        await adminService.initializeBuiltInRoles();

        expect(mockPrismaClient.role.create).not.toHaveBeenCalled();
      });
    });
  });
});
