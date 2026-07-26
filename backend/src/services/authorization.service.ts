/**
 * Authorization Service
 *
 * Central service for entity-level and admin-level authorization checks.
 * Implements:
 * - Admin access validation via role.canAccessAdmin from database
 * - Entity permission checks (assets, risks, controls, incidents)
 * - Role expiry validation (validUntil)
 * - Scope and organization unit restrictions
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

// ---- Types ----

export type EntityPermissionLevel = 'none' | 'readonly' | 'readwrite';

export interface EntityPermissions {
  assets?: EntityPermissionLevel;
  risks?: EntityPermissionLevel;
  controls?: EntityPermissionLevel;
  incidents?: EntityPermissionLevel;
  costPlanning?: EntityPermissionLevel;
}

export type EntityType = keyof EntityPermissions;
export type EntityAction = 'read' | 'write' | 'delete';

export interface RoleWithExpiry {
  roleName: string;
  canAccessAdmin: boolean;
  entityPermissions: EntityPermissions | null;
  validUntil: Date | null;
  scopeId: string | null;
  organizationUnitId: string | null;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

// ---- Service ----

export class AuthorizationService {
  /**
   * Fetch all effective roles for a user, including group-assigned roles.
   * Returns role data with expiry and scope information from the database.
   */
  async getUserRoles(userId: string): Promise<RoleWithExpiry[]> {
    // Direct role assignments
    const directAssignments = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    // Group-based role assignments
    const userGroups = await prisma.userGroup.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            groupRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    const roles: RoleWithExpiry[] = [];
    const seenRoleNames = new Set<string>();

    // Process direct assignments
    for (const assignment of directAssignments) {
      const roleName = assignment.roleName;
      if (seenRoleNames.has(roleName)) continue;
      seenRoleNames.add(roleName);

      roles.push({
        roleName,
        canAccessAdmin: assignment.role?.canAccessAdmin ?? roleName === 'system_admin',
        entityPermissions: (assignment.role?.entityPermissions as EntityPermissions | null) ?? (roleName === 'system_admin' ? {
          assets: 'readwrite',
          risks: 'readwrite',
          controls: 'readwrite',
          incidents: 'readwrite',
          costPlanning: 'readwrite',
        } : null),
        validUntil: assignment.validUntil,
        scopeId: assignment.scopeId,
        organizationUnitId: assignment.organizationUnitId,
      });
    }

    // Process group-based assignments
    for (const ug of userGroups) {
      for (const gr of ug.group?.groupRoles ?? []) {
        const roleName = gr.roleName;
        if (seenRoleNames.has(roleName)) continue;
        seenRoleNames.add(roleName);

        roles.push({
          roleName,
          canAccessAdmin: gr.role?.canAccessAdmin ?? roleName === 'system_admin',
          entityPermissions: (gr.role?.entityPermissions as EntityPermissions | null) ?? (roleName === 'system_admin' ? {
            assets: 'readwrite',
            risks: 'readwrite',
            controls: 'readwrite',
            incidents: 'readwrite',
            costPlanning: 'readwrite',
          } : null),
          validUntil: null, // Group roles don't have expiry in current schema
          scopeId: null,
          organizationUnitId: null,
        });
      }
    }

    return roles;
  }

  /**
   * Check if a role assignment is still valid (not expired).
   */
  isRoleActive(role: RoleWithExpiry): boolean {
    if (role.validUntil !== null && role.validUntil !== undefined) {
      return new Date() <= role.validUntil;
    }
    return true; // No expiry = always active
  }

  /**
   * Get all active roles for a user (filters out expired roles).
   */
  async getActiveRoles(userId: string): Promise<RoleWithExpiry[]> {
    const roles = await this.getUserRoles(userId);
    return roles.filter((r) => this.isRoleActive(r));
  }

  /**
   * Check if a user has admin access.
   * Validates against role.canAccessAdmin from database (not legacy string comparison).
   */
  async canAccessAdmin(userId: string): Promise<boolean> {
    const activeRoles = await this.getActiveRoles(userId);
    return activeRoles.some((role) => role.canAccessAdmin === true);
  }

  /**
   * Require admin access - throws AppError if user cannot access admin.
   */
  async requireAdminAccess(userId: string): Promise<void> {
    const hasAccess = await this.canAccessAdmin(userId);
    if (!hasAccess) {
      throw new AppError('Administration access required. Your role does not have admin privileges or has expired.', 403);
    }
  }

  /**
   * Check entity-level permission for a specific action.
   *
   * @param userId - The user performing the action
   * @param entityType - The type of entity (assets, risks, controls, incidents)
   * @param action - The action being performed (read, write, delete)
   * @param entityId - Optional specific entity ID for scope checks
   * @returns AuthorizationResult with allowed status and optional reason
   */
  async checkEntityPermission(
    userId: string,
    entityType: EntityType,
    action: EntityAction,
    entityId?: string
  ): Promise<AuthorizationResult> {
    const activeRoles = await this.getActiveRoles(userId);

    if (activeRoles.length === 0) {
      return { allowed: false, reason: 'No active roles assigned' };
    }

    // Determine the minimum permission level required for the action
    const requiredLevel = this.getRequiredPermissionLevel(action);

    // Check each role's entity permissions
    let maxPermission: EntityPermissionLevel = 'none';
    let hasAnyEntityPermissions = false;

    for (const role of activeRoles) {
      if (!role.entityPermissions) continue;
      hasAnyEntityPermissions = true;

      const level = role.entityPermissions[entityType];
      if (!level || level === 'none') continue;

      // Aggregate maximum permission across all roles
      if (this.permissionLevelValue(level) > this.permissionLevelValue(maxPermission)) {
        maxPermission = level;
      }
    }

    if (!hasAnyEntityPermissions) {
      return { allowed: false, reason: 'No entity permissions configured (default deny)' };
    }

    const allowed = this.permissionLevelValue(maxPermission) >= this.permissionLevelValue(requiredLevel);

    if (!allowed) {
      return {
        allowed: false,
        reason: `Insufficient permission for ${entityType}. Required: ${requiredLevel}, Granted: ${maxPermission}`,
      };
    }

    // If entityId provided, check scope restrictions
    if (entityId) {
      const scopeResult = await this.checkScopeRestriction(userId, entityType, entityId);
      if (!scopeResult.allowed) {
        return scopeResult;
      }
    }

    return { allowed: true };
  }

  /**
   * Require entity permission - throws AppError if not authorized.
   */
  async requireEntityPermission(
    userId: string,
    entityType: EntityType,
    action: EntityAction,
    entityId?: string
  ): Promise<void> {
    const result = await this.checkEntityPermission(userId, entityType, action, entityId);
    if (!result.allowed) {
      throw new AppError(`Authorization denied: ${result.reason}`, 403);
    }
  }

  /**
   * Map an action to the required permission level.
   */
  private getRequiredPermissionLevel(action: EntityAction): EntityPermissionLevel {
    switch (action) {
      case 'read':
        return 'readonly';
      case 'write':
      case 'delete':
        return 'readwrite';
      default:
        return 'readwrite';
    }
  }

  /**
   * Numeric value for permission level comparison.
   */
  private permissionLevelValue(level: EntityPermissionLevel): number {
    switch (level) {
      case 'none':
        return 0;
      case 'readonly':
        return 1;
      case 'readwrite':
        return 2;
      default:
        return 0;
    }
  }

  /**
   * Check scope restrictions for a specific entity.
   * If the user's role has a scopeId or organizationUnitId, the entity must match.
   */
  private async checkScopeRestriction(
    userId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<AuthorizationResult> {
    const activeRoles = await this.getActiveRoles(userId);

    // Find roles that have scope restrictions and also grant access to this entity type
    const scopedRoles = activeRoles.filter((role) => {
      if (!role.entityPermissions) return false;
      const level = role.entityPermissions[entityType];
      return (level && level !== 'none') && (role.scopeId !== null || role.organizationUnitId !== null);
    });

    // If no scoped roles for this entity type, no restriction applies
    if (scopedRoles.length === 0) {
      return { allowed: true };
    }

    // Check if any scoped role allows access to the specific entity
    for (const role of scopedRoles) {
      if (role.scopeId && entityId !== role.scopeId) {
        continue;
      }
      // If scope matches or no scope on this role, allow
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Entity is outside your authorized scope',
    };
  }

  /**
   * Check if user has write permission for any entity type.
   * Used to protect general write operations when entity type is not specific.
   */
  async canPerformWriteAction(userId: string): Promise<boolean> {
    const activeRoles = await this.getActiveRoles(userId);

    if (activeRoles.length === 0) return false;

    // Check all entity types for any readwrite permission
    const entityTypes: EntityType[] = ['assets', 'risks', 'controls', 'incidents', 'costPlanning'];

    for (const entityType of entityTypes) {
      for (const role of activeRoles) {
        if (!role.entityPermissions) continue;
        const level = role.entityPermissions[entityType];
        if (level === 'readwrite') return true;
      }
    }

    // If no entity permissions configured, check admin access as fallback
    return this.canAccessAdmin(userId);
  }
}

// Singleton instance
export const authorizationService = new AuthorizationService();
