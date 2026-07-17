import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { oidcService } from './oidc.service';

// --- Types ---

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  organizationUnitId?: string;
  roles?: string[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  organizationUnitId?: string;
  isActive?: boolean;
}

export interface AssignRolesDto {
  roles: string[];
}

export interface AssetTypeCreateDto {
  name: string;
  description?: string;
  category: string;
}

export interface AssetTypeUpdateDto {
  name?: string;
  description?: string;
  category?: string;
}

export interface RolePermission {
  assetType: string;
  level: 'none' | 'read' | 'read_write';
}

// Entity permission levels
export type EntityPermissionLevel = 'none' | 'readonly' | 'readwrite';

// Entity permissions mapped by entity type
export interface EntityPermissions {
  assets?: EntityPermissionLevel;
  risks?: EntityPermissionLevel;
  controls?: EntityPermissionLevel;
  incidents?: EntityPermissionLevel;
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: RolePermission[];
  canAccessAdmin?: boolean;
  entityPermissions?: EntityPermissions;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: RolePermission[];
  canAccessAdmin?: boolean;
  entityPermissions?: EntityPermissions;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
}

export interface AssignUsersToGroupDto {
  userIds: string[];
}

export interface AssignRolesToGroupDto {
  roles: string[];
}

export interface UserWithRoles {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  organizationUnitId?: string | null;
  isActive: boolean;
  roles: string[];
  groups: string[];
  isOidcLinked: boolean;
  oidcProvider?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetTypeDto {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Intune App Credentials
export interface IntuneAppCredentialsDto {
  id: string;
  name: string;
  tenantId?: string | null;
  appId?: string | null;
  isConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntuneCredentialsDto {
  name?: string;
  tenantId?: string;
  appId?: string;
  clientSecret?: string;
  clientSecretExpiresAt?: string;
  certificateThumbprint?: string;
}

export interface UpdateIntuneCredentialsDto {
  name?: string;
  tenantId?: string;
  appId?: string;
  clientSecret?: string;
  clientSecretExpiresAt?: string;
  certificateThumbprint?: string;
  isConfigured?: boolean;
}

// Built-in roles with default permissions
const BUILTIN_ROLES: CreateRoleDto[] = [
  {
    name: 'system_admin',
    description: 'Full system access, manages users, roles and all assets',
    permissions: [],
    canAccessAdmin: true,
    entityPermissions: {
      assets: 'readwrite',
      risks: 'readwrite',
      controls: 'readwrite',
      incidents: 'readwrite',
    },
  },
  {
    name: 'employee',
    description: 'Standard employee access',
    permissions: [],
    canAccessAdmin: false,
    entityPermissions: {
      assets: 'readonly',
      risks: 'readonly',
      controls: 'readonly',
      incidents: 'readonly',
    },
  },
];

// --- Service ---

export class AdminService {
  // ---- User Management ----

  async listUsers(): Promise<UserWithRoles[]> {
    const users = await prisma.user.findMany({
      include: {
        userRoles: true,
        userGroups: { include: { group: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phoneNumber: u.phoneNumber,
      organizationUnitId: u.organizationUnitId,
      isActive: u.isActive,
      roles: this.getAllRolesForUser(u),
      groups: u.userGroups.map((ug) => ug.group.name),
      isOidcLinked: !!u.oidcId,
      oidcProvider: u.oidcProvider,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  private getAllRolesForUser(user: any): string[] {
    const directRoles = user.userRoles?.map((r: any) => r.roleName) || [];
    const groupRoles: string[] = [];
    for (const ug of user.userGroups || []) {
      for (const gr of ug.group?.groupRoles || []) {
        if (!groupRoles.includes(gr.roleName)) {
          groupRoles.push(gr.roleName);
        }
      }
    }
    return [...new Set([...directRoles, ...groupRoles])];
  }

  async getUserById(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: true,
        userGroups: { include: { group: { include: { groupRoles: true } } } },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      organizationUnitId: user.organizationUnitId,
      isActive: user.isActive,
      roles: this.getAllRolesForUser(user),
      groups: user.userGroups.map((ug) => ug.group.name),
      isOidcLinked: !!user.oidcId,
      oidcProvider: user.oidcProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createUser(data: CreateUserDto, createdBy: string): Promise<UserWithRoles> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        organizationUnitId: data.organizationUnitId,
        createdBy,
      },
      include: {
        userRoles: true,
        userGroups: { include: { group: true } },
      },
    });

    // Assign default role or provided roles
    const roles = data.roles && data.roles.length > 0 ? data.roles : ['employee'];

    for (const role of roles) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleName: role,
        },
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: true,
        userGroups: { include: { group: { include: { groupRoles: true } } } },
      },
    });

    if (!fullUser) {
      throw new AppError('User creation failed', 500);
    }

    return {
      id: fullUser.id,
      email: fullUser.email,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      phoneNumber: fullUser.phoneNumber,
      organizationUnitId: fullUser.organizationUnitId,
      isActive: fullUser.isActive,
      roles: this.getAllRolesForUser(fullUser),
      groups: fullUser.userGroups.map((ug) => ug.group.name),
      isOidcLinked: !!fullUser.oidcId,
      oidcProvider: fullUser.oidcProvider,
      createdAt: fullUser.createdAt,
      updatedAt: fullUser.updatedAt,
    };
  }

  async updateUser(id: string, data: UpdateUserDto, updatedBy: string): Promise<UserWithRoles> {
    const existing = await prisma.user.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = { ...data };
    updateData.updatedBy = updatedBy;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: true,
        userGroups: { include: { group: { include: { groupRoles: true } } } },
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      organizationUnitId: user.organizationUnitId,
      isActive: user.isActive,
      roles: this.getAllRolesForUser(user),
      groups: user.userGroups.map((ug) => ug.group.name),
      isOidcLinked: !!user.oidcId,
      oidcProvider: user.oidcProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const existing = await prisma.user.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userGroup.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return { message: 'User deleted successfully' };
  }

  async changePassword(userId: string, newPassword: string, changedBy: string): Promise<void> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePasswordOnNext: true,
        passwordChangedAt: new Date(),
        updatedBy: changedBy,
      },
    });
  }

  // ---- Role Management ----

  async assignRoles(userId: string, data: AssignRolesDto): Promise<UserWithRoles> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    // Remove all existing roles
    await prisma.userRole.deleteMany({ where: { userId } });

    // Assign new roles
    for (const role of data.roles) {
      await prisma.userRole.create({
        data: {
          userId,
          roleName: role,
        },
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: true,
        userGroups: { include: { group: { include: { groupRoles: true } } } },
      },
    });

    if (!updated) {
      throw new AppError('User not found after role assignment', 500);
    }

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phoneNumber: updated.phoneNumber,
      organizationUnitId: updated.organizationUnitId,
      isActive: updated.isActive,
      roles: this.getAllRolesForUser(updated),
      groups: updated.userGroups.map((ug) => ug.group.name),
      isOidcLinked: !!updated.oidcId,
      oidcProvider: updated.oidcProvider,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getAvailableRoles(): Promise<any[]> {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });

    // Also include built-in roles that may not be in DB yet
    const roleNames = roles.map((r) => r.name);
    for (const builtin of BUILTIN_ROLES) {
      if (!roleNames.includes(builtin.name)) {
        roles.push({
          id: '',
          name: builtin.name,
          description: builtin.description ?? null,
          isBuiltIn: true,
          permissions: builtin.permissions as any,
          canAccessAdmin: builtin.canAccessAdmin ?? false,
          entityPermissions: (builtin.entityPermissions as any) ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return roles;
  }

  async createRole(data: CreateRoleDto): Promise<any> {
    const existing = await prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new AppError('Role with this name already exists', 409);
    }

    return await prisma.role.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isBuiltIn: false,
        permissions: data.permissions as any,
        canAccessAdmin: data.canAccessAdmin ?? false,
        entityPermissions: (data.entityPermissions as any) ?? null,
      },
    });
  }

  async updateRole(id: string, data: UpdateRoleDto): Promise<any> {
    const existing = await prisma.role.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Role not found', 404);
    }
    if (existing.isBuiltIn) {
      throw new AppError('Built-in roles cannot be modified', 400);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.role.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new AppError('Role with this name already exists', 409);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.permissions !== undefined) updateData.permissions = data.permissions as any;
    if (data.canAccessAdmin !== undefined) updateData.canAccessAdmin = data.canAccessAdmin;
    if (data.entityPermissions !== undefined) updateData.entityPermissions = data.entityPermissions;

    return await prisma.role.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteRole(id: string): Promise<{ message: string }> {
    const existing = await prisma.role.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Role not found', 404);
    }
    if (existing.isBuiltIn) {
      throw new AppError('Built-in roles cannot be deleted', 400);
    }

    // Check if role is assigned to any users or groups
    const userRoleCount = await prisma.userRole.count({
      where: { roleId: id },
    });
    const groupRoleCount = await prisma.groupRole.count({
      where: { roleId: id },
    });

    if (userRoleCount > 0 || groupRoleCount > 0) {
      throw new AppError('Cannot delete role that is assigned to users or groups', 400);
    }

    await prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  async initializeBuiltInRoles(): Promise<void> {
    for (const role of BUILTIN_ROLES) {
      const existing = await prisma.role.findUnique({
        where: { name: role.name },
      });
      if (!existing) {
        await prisma.role.create({
          data: {
            name: role.name,
            description: role.description ?? null,
            isBuiltIn: true,
            permissions: role.permissions as any,
            canAccessAdmin: role.canAccessAdmin ?? false,
            entityPermissions: (role.entityPermissions as any) ?? null,
          },
        });
      }
    }
  }

  // ---- Group Management ----

  async listGroups(): Promise<any[]> {
    return await prisma.group.findMany({
      include: {
        userGroups: { include: { user: true } },
        groupRoles: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createGroup(data: CreateGroupDto): Promise<any> {
    const existing = await prisma.group.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new AppError('Group with this name already exists', 409);
    }

    return await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async updateGroup(id: string, data: UpdateGroupDto): Promise<any> {
    const existing = await prisma.group.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Group not found', 404);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.group.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new AppError('Group with this name already exists', 409);
      }
    }

    return await prisma.group.update({
      where: { id },
      data,
    });
  }

  async deleteGroup(id: string): Promise<{ message: string }> {
    const existing = await prisma.group.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Group not found', 404);
    }

    await prisma.userGroup.deleteMany({ where: { groupId: id } });
    await prisma.groupRole.deleteMany({ where: { groupId: id } });
    await prisma.group.delete({ where: { id } });

    return { message: 'Group deleted successfully' };
  }

  async assignUsersToGroup(groupId: string, data: AssignUsersToGroupDto): Promise<void> {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Remove existing assignments
    await prisma.userGroup.deleteMany({ where: { groupId } });

    // Create new assignments
    for (const userId of data.userIds) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;
      await prisma.userGroup.create({
        data: { userId, groupId },
      });
    }
  }

  async assignRolesToGroup(groupId: string, data: AssignRolesToGroupDto): Promise<void> {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Remove existing roles
    await prisma.groupRole.deleteMany({ where: { groupId } });

    // Assign new roles
    for (const roleName of data.roles) {
      await prisma.groupRole.create({
        data: { groupId, roleName },
      });
    }
  }

  // ---- OIDC Config Management ----

  async getOidcConfig(): Promise<any> {
    const config = await oidcService.getConfig();
    // Don't expose clientSecret
    const { clientSecret, ...safeConfig } = config;
    return safeConfig;
  }

  async updateOidcConfig(data: any): Promise<any> {
    const config = await oidcService.updateConfig(data);
    const { clientSecret, ...safeConfig } = config;
    return safeConfig;
  }

  // ---- Intune App Credentials Management ----

  async getIntuneCredentials(): Promise<IntuneAppCredentialsDto | null> {
    const credentials = await prisma.intuneAppCredentials.findFirst();
    if (!credentials) return null;
    return {
      id: credentials.id,
      name: credentials.name,
      tenantId: credentials.tenantId,
      appId: credentials.appId,
      isConfigured: credentials.isConfigured,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt,
    };
  }

  async createIntuneCredentials(data: CreateIntuneCredentialsDto): Promise<IntuneAppCredentialsDto> {
    const existing = await prisma.intuneAppCredentials.findFirst();
    if (existing) {
      throw new AppError('Credentials already exist. Use updateIntuneCredentials to modify.', 409);
    }

    const created = await prisma.intuneAppCredentials.create({
      data: {
        name: data.name ?? 'Intune API Credentials',
        tenantId: data.tenantId ?? null,
        appId: data.appId ?? null,
        clientSecret: data.clientSecret ?? null,
        clientSecretExpiresAt: data.clientSecretExpiresAt ? new Date(data.clientSecretExpiresAt) : null,
        certificateThumbprint: data.certificateThumbprint ?? null,
        isConfigured: false,
      },
    });

    return {
      id: created.id,
      name: created.name,
      tenantId: created.tenantId,
      appId: created.appId,
      isConfigured: created.isConfigured,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateIntuneCredentials(data: UpdateIntuneCredentialsDto): Promise<IntuneAppCredentialsDto | null> {
    const existing = await prisma.intuneAppCredentials.findFirst();
    if (!existing) {
      throw new AppError('No credentials found. Use createIntuneCredentials first.', 404);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    if (data.appId !== undefined) updateData.appId = data.appId;
    if (data.clientSecret !== undefined) updateData.clientSecret = data.clientSecret;
    if (data.clientSecretExpiresAt !== undefined) updateData.clientSecretExpiresAt = new Date(data.clientSecretExpiresAt);
    if (data.certificateThumbprint !== undefined) updateData.certificateThumbprint = data.certificateThumbprint;
    if (data.isConfigured !== undefined) updateData.isConfigured = data.isConfigured;

    const updated = await prisma.intuneAppCredentials.update({
      where: { id: existing.id },
      data: updateData,
    });

    return {
      id: updated.id,
      name: updated.name,
      tenantId: updated.tenantId,
      appId: updated.appId,
      isConfigured: updated.isConfigured,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteIntuneCredentials(): Promise<{ message: string }> {
    const existing = await prisma.intuneAppCredentials.findFirst();
    if (!existing) {
      throw new AppError('No credentials found', 404);
    }

    await prisma.intuneAppCredentials.deleteMany({});
    return { message: 'Intune app credentials deleted successfully' };
  }

  // ---- Asset Type Management ----

  async listAssetTypes(): Promise<AssetTypeDto[]> {
    const types = await prisma.assetType.findMany({
      orderBy: { name: 'asc' },
    });

    return types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      isArchived: t.isArchived,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async createAssetType(data: AssetTypeCreateDto): Promise<AssetTypeDto> {
    const existing = await prisma.assetType.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new AppError('Asset type with this name already exists', 409);
    }

    const type = await prisma.assetType.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
      },
    });

    return {
      id: type.id,
      name: type.name,
      description: type.description,
      category: type.category,
      isArchived: type.isArchived,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  async updateAssetType(id: string, data: AssetTypeUpdateDto): Promise<AssetTypeDto> {
    const existing = await prisma.assetType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Asset type not found', 404);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.assetType.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new AppError('Asset type with this name already exists', 409);
      }
    }

    const type = await prisma.assetType.update({
      where: { id },
      data,
    });

    return {
      id: type.id,
      name: type.name,
      description: type.description,
      category: type.category,
      isArchived: type.isArchived,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  async deleteAssetType(id: string): Promise<{ message: string }> {
    const existing = await prisma.assetType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Asset type not found', 404);
    }

    const assetCount = await prisma.asset.count({
      where: { assetTypeId: id },
    });
    if (assetCount > 0) {
      throw new AppError('Cannot delete asset type with associated assets', 400);
    }

    await prisma.assetType.delete({ where: { id } });

    return { message: 'Asset type deleted successfully' };
  }

  async archiveAssetType(id: string): Promise<AssetTypeDto> {
    const existing = await prisma.assetType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Asset type not found', 404);
    }

    const type = await prisma.assetType.update({
      where: { id },
      data: { isArchived: true },
    });

    return {
      id: type.id,
      name: type.name,
      description: type.description,
      category: type.category,
      isArchived: type.isArchived,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  // ---- Business Process Management (RSK-010) ----

  async listBusinessProcesses() {
    const processes = await prisma.businessProcess.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { risks: true },
        },
      },
    });

    return processes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      owner: p.processOwner,
      criticality: p.criticality,
      status: p.status,
      riskCount: p._count.risks,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async getBusinessProcessById(id: string) {
    const process = await prisma.businessProcess.findUnique({
      where: { id },
      include: {
        risks: {
          where: { isArchived: false },
        },
      },
    });

    if (!process) {
      throw new AppError('Business process not found', 404);
    }

    return {
      id: process.id,
      name: process.name,
      description: process.description,
      owner: process.processOwner,
      criticality: process.criticality,
      status: process.status,
      risks: process.risks,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    };
  }

  async createBusinessProcess(data: { name: string; description?: string; owner?: string; criticality?: string; status?: string }) {
    const existing = await prisma.businessProcess.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      throw new AppError('Business process with this name already exists', 409);
    }

    const displayId = `BP-${Date.now()}`;
    const process = await prisma.businessProcess.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        processOwner: data.owner ?? '',
        criticality: data.criticality ?? 'low',
        status: data.status ?? 'active',
        displayId,
      },
    });

    return {
      id: process.id,
      name: process.name,
      description: process.description,
      owner: process.processOwner,
      criticality: process.criticality,
      status: process.status,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    };
  }

  async updateBusinessProcess(id: string, data: { name?: string; description?: string; owner?: string; criticality?: string; status?: string }) {
    const existing = await prisma.businessProcess.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Business process not found', 404);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.businessProcess.findFirst({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new AppError('Business process with this name already exists', 409);
      }
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.owner !== undefined) updateData.processOwner = data.owner;
    if (data.criticality !== undefined) updateData.criticality = data.criticality;
    if (data.status !== undefined) updateData.status = data.status;

    const process = await prisma.businessProcess.update({
      where: { id },
      data: updateData,
    });

    return {
      id: process.id,
      name: process.name,
      description: process.description,
      owner: process.processOwner,
      criticality: process.criticality,
      status: process.status,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    };
  }

  async deleteBusinessProcess(id: string) {
    const existing = await prisma.businessProcess.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Business process not found', 404);
    }

    // Check if any risks are associated with this business process
    const riskCount = await prisma.risk.count({
      where: { businessProcessId: id },
    });
    if (riskCount > 0) {
      throw new AppError('Cannot delete business process with associated risks', 400);
    }

    await prisma.businessProcess.delete({ where: { id } });

    return { message: 'Business process deleted successfully' };
  }
}

export const adminService = new AdminService();
