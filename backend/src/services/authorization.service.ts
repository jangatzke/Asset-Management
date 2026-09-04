import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const GRANULAR_PERMISSIONS = [
  'assets.read', 'assets.write', 'assets.archive',
  'risks.read', 'risks.write', 'risks.assess', 'risks.approve', 'risks.accept',
  'controls.read', 'controls.write', 'controls.test', 'controls.approve',
  'incidents.read', 'incidents.write', 'incidents.assess', 'incidents.report', 'incidents.close',
  'tickets.read', 'tickets.write', 'tickets.assign', 'tickets.close', 'tickets.escalate', 'tickets.approve',
  'serviceCatalog.read', 'serviceCatalog.manage',
  'suppliers.read', 'suppliers.write', 'suppliers.approve',
  'bcm.read', 'bcm.write', 'bcm.approve',
  'audits.read', 'audits.write', 'audits.close',
  'correctiveActions.read', 'correctiveActions.write', 'correctiveActions.verify',
  'training.read', 'training.manage',
  'documents.read', 'documents.write', 'documents.approve',
  'interestedParties.read', 'interestedParties.write',
  'evidence.read', 'evidence.write', 'evidence.export',
  'nis2.read', 'nis2.write', 'nis2.approve',
  'administration.access',
] as const;

export type PermissionName = typeof GRANULAR_PERMISSIONS[number];

export type EntityType =
  | 'assets'
  | 'risks'
  | 'controls'
  | 'incidents'
  | 'tickets'
  | 'suppliers'
  | 'bcm'
  | 'audits'
  | 'correctiveActions'
  | 'training'
  | 'documents'
  | 'interestedParties'
  | 'evidence'
  | 'nis2'
  | 'administration'
  | 'costPlanning';

export type EntityAction = 'read' | 'write' | 'delete' | 'archive' | 'assess' | 'approve' | 'accept' | 'test' | 'report' | 'close' | 'verify' | 'manage' | 'export';

export interface ScopeConstraints {
  legalEntityId: string | null;
  organizationUnitId: string | null;
  scopeId: string | null;
  siteId: string | null;
}

export interface EffectiveRoleAssignment extends ScopeConstraints {
  roleName: string;
  canAccessAdmin: boolean;
  permissions: Set<string>;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface ResolvedScopeConstraints {
  legalEntityIds: Set<string>;
  organizationUnitIds: Set<string>;
  scopeIds: Set<string>;
  siteIds: Set<string>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

type ScopedAssignment = Pick<EffectiveRoleAssignment, 'legalEntityId' | 'organizationUnitId' | 'scopeId' | 'siteId'>;

export const WRITE_PERMISSION_BY_RESOURCE: Record<string, PermissionName> = {
  suppliers: 'suppliers.write',
  bias: 'bcm.write',
  bcps: 'bcm.write',
  auditPlans: 'audits.write',
  correctiveActions: 'correctiveActions.write',
  trainingAssignments: 'training.manage',
  documents: 'documents.write',
  interestedParties: 'interestedParties.write',
  evidence: 'evidence.write',
  nis2: 'nis2.write',
  controls: 'controls.write',
  risks: 'risks.write',
  assets: 'assets.write',
  incidents: 'incidents.write',
  tickets: 'tickets.write',
};

export const READ_PERMISSION_BY_RESOURCE: Record<string, PermissionName> = {
  suppliers: 'suppliers.read',
  bias: 'bcm.read',
  bcps: 'bcm.read',
  auditPlans: 'audits.read',
  correctiveActions: 'correctiveActions.read',
  trainingAssignments: 'training.read',
  documents: 'documents.read',
  interestedParties: 'interestedParties.read',
  evidence: 'evidence.read',
  nis2: 'nis2.read',
  controls: 'controls.read',
  risks: 'risks.read',
  assets: 'assets.read',
  incidents: 'incidents.read',
  tickets: 'tickets.read',
};

export class AuthorizationService {
  async getUserRoles(userId: string): Promise<EffectiveRoleAssignment[]> {
    const db = prisma as any;
    const directAssignments = await db.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const userGroups = await db.userGroup.findMany({
      where: { userId },
      include: {
        group: {
          include: { groupRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
        },
      },
    });

    const roles: EffectiveRoleAssignment[] = [];
    for (const assignment of directAssignments) roles.push(this.mapAssignment(assignment, assignment.role, assignment.validFrom ?? null, assignment.validUntil ?? null));
    for (const userGroup of userGroups) {
      for (const groupRole of userGroup.group?.groupRoles ?? []) roles.push(this.mapAssignment(groupRole, groupRole.role, groupRole.validFrom ?? null, groupRole.validUntil ?? null));
    }
    return roles;
  }

  isRoleActive(role: Pick<EffectiveRoleAssignment, 'validFrom' | 'validUntil'>): boolean {
    const now = new Date();
    return (!role.validFrom || role.validFrom <= now) && (!role.validUntil || now <= role.validUntil);
  }

  async getActiveRoles(userId: string): Promise<EffectiveRoleAssignment[]> {
    return (await this.getUserRoles(userId)).filter((role) => this.isRoleActive(role));
  }

  async can(userId: string, permission: PermissionName): Promise<boolean> {
    const activeRoles = await this.getActiveRoles(userId);
    return activeRoles.some((role) => role.permissions.has(permission));
  }

  async canForEntity(userId: string, permission: PermissionName, entityType: EntityType, entityId: string): Promise<boolean> {
    const activeRoles = await this.getActiveRoles(userId);
    const grantingRoles = activeRoles.filter((role) => role.permissions.has(permission));
    if (grantingRoles.length === 0) return false;

    if (grantingRoles.some((role) => !this.hasScopeConstraint(role))) return true;
    const entityScope = await this.resolveEntityScope(entityType, entityId);
    return grantingRoles.some((role) => this.scopeMatches(role, entityScope));
  }

  async require(userId: string, permission: PermissionName): Promise<void> {
    if (!(await this.can(userId, permission))) throw new AppError(`Authorization denied: ${permission} required`, 403);
  }

  async requireForEntity(userId: string, permission: PermissionName, entityType: EntityType, entityId: string): Promise<void> {
    if (!(await this.canForEntity(userId, permission, entityType, entityId))) {
      throw new AppError(`Authorization denied: ${permission} required for entity or entity is outside authorized scope`, 403);
    }
  }

  async requireForScope(userId: string, permission: PermissionName, scope: ScopeConstraints): Promise<void> {
    const activeRoles = await this.getActiveRoles(userId);
    const grantingRoles = activeRoles.filter((role) => role.permissions.has(permission));
    const resolvedScope = await this.resolveScopeSet(scope);
    if (grantingRoles.length === 0 || !grantingRoles.some((role) => !this.hasScopeConstraint(role) || this.scopeMatches(role, resolvedScope))) {
      throw new AppError(`Authorization denied: ${permission} required for target scope`, 403);
    }
  }

  async resolveTargetScope(scope: ScopeConstraints): Promise<ResolvedScopeConstraints> {
    return this.resolveScopeSet(scope);
  }

  async buildReadFilter(userId: string, entityType: EntityType): Promise<Prisma.InputJsonObject | Record<string, unknown>> {
    const permission = this.readPermissionForEntity(entityType);
    if (!permission) return { id: { equals: '__phase1_no_permission__' } };

    const activeRoles = await this.getActiveRoles(userId);
    const grantingRoles = activeRoles.filter((role) => role.permissions.has(permission));
    if (grantingRoles.length === 0) return { id: { equals: '__phase1_no_permission__' } };
    if (grantingRoles.some((role) => !this.hasScopeConstraint(role))) return {};

    const scopedFilters = grantingRoles.map((role) => this.buildScopedFilter(entityType, role)).filter(Boolean) as Record<string, unknown>[];
    return scopedFilters.length ? { OR: scopedFilters } : { id: { equals: '__phase1_no_scope_match__' } };
  }

  async canAccessAdmin(userId: string): Promise<boolean> {
    return this.can(userId, 'administration.access');
  }

  async requireAdminAccess(userId: string): Promise<void> {
    await this.require(userId, 'administration.access');
  }

  async checkEntityPermission(userId: string, entityType: EntityType, action: EntityAction, entityId?: string): Promise<AuthorizationResult> {
    const permission = this.permissionForAction(entityType, action);
    if (!permission) return { allowed: false, reason: `No explicit permission mapping for ${entityType}.${action}` };
    const allowed = entityId ? await this.canForEntity(userId, permission, entityType, entityId) : await this.can(userId, permission);
    return allowed ? { allowed: true } : { allowed: false, reason: `${permission} denied` };
  }

  async requireEntityPermission(userId: string, entityType: EntityType, action: EntityAction, entityId?: string): Promise<void> {
    const permission = this.permissionForAction(entityType, action);
    if (!permission) throw new AppError(`Authorization denied: no permission mapping for ${entityType}.${action}`, 403);
    if (entityId) await this.requireForEntity(userId, permission, entityType, entityId);
    else await this.require(userId, permission);
  }

  async canPerformWriteAction(userId: string): Promise<boolean> {
    const activeRoles = await this.getActiveRoles(userId);
    return activeRoles.some((role) => [...role.permissions].some((permission) => permission.endsWith('.write') || permission.endsWith('.manage')));
  }

  private mapAssignment(assignment: any, role: any, validFrom: Date | null, validUntil: Date | null): EffectiveRoleAssignment {
    const permissions = new Set<string>();
    for (const rolePermission of role?.rolePermissions ?? []) {
      if (rolePermission.permission?.name) permissions.add(rolePermission.permission.name);
    }

    // Effective authorization is derived from RolePermission rows.  The system role
    // remains a bootstrap exception; custom roles must hold administration.access.
    if (assignment.roleName === 'system_admin') permissions.add('administration.access');
    if (assignment.roleName === 'system_admin') GRANULAR_PERMISSIONS.forEach((permission) => permissions.add(permission));
    this.addLegacyPermissions(permissions, role?.entityPermissions);

    return {
      roleName: assignment.roleName,
      canAccessAdmin: permissions.has('administration.access'),
      permissions,
      validFrom,
      validUntil,
      legalEntityId: assignment.legalEntityId ?? null,
      organizationUnitId: assignment.organizationUnitId ?? null,
      scopeId: assignment.scopeId ?? null,
      siteId: assignment.siteId ?? null,
    };
  }

  private addLegacyPermissions(_permissions: Set<string>, _entityPermissions: unknown): void {
    // Legacy entity permissions have been fully migrated to RolePermission-based
    // authorization. This method is intentionally kept as a no-op to avoid
    // breaking the mapAssignment interface while serving as a reminder that
    // legacy permissions are no longer supported.
  }

  private hasScopeConstraint(role: ScopedAssignment): boolean {
    return Boolean(role.legalEntityId || role.organizationUnitId || role.scopeId || role.siteId);
  }

  private scopeMatches(role: ScopedAssignment, entityScope: ScopeConstraints | ResolvedScopeConstraints): boolean {
    const resolved = this.asResolvedScope(entityScope);
    if (role.legalEntityId && !resolved.legalEntityIds.has(role.legalEntityId)) return false;
    if (role.organizationUnitId && !resolved.organizationUnitIds.has(role.organizationUnitId)) return false;
    if (role.siteId && !resolved.siteIds.has(role.siteId)) return false;
    if (role.scopeId && !resolved.scopeIds.has(role.scopeId)) return false;
    return true;
  }

  private async resolveEntityScope(entityType: EntityType, entityId: string): Promise<ResolvedScopeConstraints> {
    const db = prisma as any;
    if (entityType === 'assets') {
      const asset = await db.asset.findUnique({ where: { id: entityId }, include: { organizationUnit: true, location: { include: { organizationUnit: true } } } });
      if (!asset) throw new AppError('Asset not found', 404);
      const organizationUnitId = asset.organizationUnitId ?? asset.location?.organizationUnitId ?? null;
      const legalEntityId = asset.organizationUnit?.legalEntityId ?? asset.location?.organizationUnit?.legalEntityId ?? null;
      return this.resolveScopeSet({ legalEntityId, organizationUnitId, siteId: asset.locationId ?? null, scopeId: null });
    }
    if (entityType === 'risks') {
      const risk = await db.risk.findUnique({ where: { id: entityId }, include: { organizationUnit: true } });
      if (!risk) throw new AppError('Risk not found', 404);
      const legalEntityId = risk.organizationUnit?.legalEntityId ?? null;
      return this.resolveScopeSet({ legalEntityId, organizationUnitId: risk.organizationUnitId ?? null, siteId: null, scopeId: null });
    }
    if (entityType === 'controls') {
      const implementation = await db.controlImplementation.findUnique({ where: { id: entityId }, include: { site: { include: { organizationUnit: true } }, organizationUnit: true } });
      if (implementation) {
        const legalEntityId = implementation.organizationUnit?.legalEntityId ?? implementation.site?.organizationUnit?.legalEntityId ?? null;
        return this.resolveScopeSet({ legalEntityId, organizationUnitId: implementation.organizationUnitId ?? implementation.site?.organizationUnitId ?? null, siteId: implementation.siteId ?? null, scopeId: implementation.scopeId ?? null });
      }
      const control = await db.control.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!control) throw new AppError('Control not found', 404);
      // Controls without a ControlImplementation are global (no scope constraints).
      return this.emptyResolvedScope();
    }
    if (entityType === 'tickets') {
      const ticketAsset = await db.ticketAsset.findFirst({ where: { ticketId: entityId }, include: { asset: { include: { organizationUnit: true, location: { include: { organizationUnit: true } } } } } });
      if (ticketAsset?.asset) {
        const legalEntityId = ticketAsset.asset.organizationUnit?.legalEntityId ?? ticketAsset.asset.location?.organizationUnit?.legalEntityId ?? null;
        return this.resolveScopeSet({ legalEntityId, organizationUnitId: ticketAsset.asset.organizationUnitId ?? ticketAsset.asset.location?.organizationUnitId ?? null, siteId: ticketAsset.asset.locationId ?? null, scopeId: null });
      }
      // Ticket without associated asset: cannot scope by asset hierarchy.
      return this.emptyResolvedScope();
    }
    if (entityType === 'incidents') {
      const incidentAsset = await db.incidentAsset.findFirst({ where: { incidentId: entityId }, include: { asset: { include: { organizationUnit: true, location: { include: { organizationUnit: true } } } } } });
      if (incidentAsset?.asset) {
        const legalEntityId = incidentAsset.asset.organizationUnit?.legalEntityId ?? incidentAsset.asset.location?.organizationUnit?.legalEntityId ?? null;
        return this.resolveScopeSet({ legalEntityId, organizationUnitId: incidentAsset.asset.organizationUnitId ?? incidentAsset.asset.location?.organizationUnitId ?? null, siteId: incidentAsset.asset.locationId ?? null, scopeId: null });
      }
      // Incident without associated asset: cannot scope by asset hierarchy.
      return this.emptyResolvedScope();
    }
    // Unknown entity types: fall through to empty scope (no scope constraints applied).
    return this.emptyResolvedScope();
  }

  private async findScopeIdsForLegalEntity(legalEntityId: string | null): Promise<Set<string>> {
    if (!legalEntityId) return new Set();
    const memberships = await (prisma as any).ismsScopeLegalEntity.findMany({ where: { legalEntityId }, select: { scopeId: true }, orderBy: { scopeId: 'asc' } });
    return new Set((memberships ?? []).map((membership: { scopeId: string }) => membership.scopeId));
  }

  private buildScopedFilter(entityType: EntityType, role: ScopedAssignment): Record<string, unknown> | null {
    const orgUnitClause = role.organizationUnitId ? { organizationUnitId: role.organizationUnitId } : undefined;
    const legalEntityOrgClause = role.legalEntityId ? { organizationUnit: { legalEntityId: role.legalEntityId } } : undefined;
    const assetSiteClause = role.siteId ? { locationId: role.siteId } : undefined;
    const scopeOrgClause = role.scopeId ? { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: role.scopeId } } } } } : undefined;

    if (entityType === 'assets') return this.andFilter([orgUnitClause, legalEntityOrgClause, assetSiteClause, scopeOrgClause]);
    if (entityType === 'risks') return this.andFilter([orgUnitClause, legalEntityOrgClause, scopeOrgClause]);
    if (entityType === 'controls') {
      return { implementations: { some: this.buildControlImplementationFilter(role) } };
    }
    if (entityType === 'tickets') {
      return { assets: { some: { asset: this.andFilter([orgUnitClause, legalEntityOrgClause, assetSiteClause, scopeOrgClause]) } } };
    }
    if (entityType === 'incidents') {
      return { incidentAssets: { some: { asset: this.andFilter([orgUnitClause, legalEntityOrgClause, assetSiteClause, scopeOrgClause]) } } };
    }
    return this.hasScopeConstraint(role) ? null : {};
  }

  private andFilter(filters: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    const active = filters.filter(Boolean) as Record<string, unknown>[];
    if (active.length === 0) return {};
    if (active.length === 1) return active[0];
    return { AND: active };
  }

  public buildControlImplementationFilter(role: ScopedAssignment): Record<string, unknown> {
    const legalEntityClause = role.legalEntityId ? { OR: [{ organizationUnit: { legalEntityId: role.legalEntityId } }, { site: { organizationUnit: { legalEntityId: role.legalEntityId } } }] } : undefined;
    const orgUnitClause = role.organizationUnitId ? { OR: [{ organizationUnitId: role.organizationUnitId }, { site: { organizationUnitId: role.organizationUnitId } }] } : undefined;
    const siteClause = role.siteId ? { siteId: role.siteId } : undefined;
    const scopeClause = role.scopeId ? { OR: [{ scopeId: role.scopeId }, { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: role.scopeId } } } } }, { site: { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: role.scopeId } } } } } }] } : undefined;
    return this.andFilter([legalEntityClause, orgUnitClause, siteClause, scopeClause]);
  }

  async buildControlImplementationReadFilter(userId: string): Promise<Record<string, unknown>> {
    const activeRoles = await this.getActiveRoles(userId);
    const grantingRoles = activeRoles.filter((role) => role.permissions.has('controls.read'));
    if (grantingRoles.length === 0) return { id: { equals: '__phase1_no_permission__' } };
    if (grantingRoles.some((role) => !this.hasScopeConstraint(role))) return {};
    const scopedFilters = grantingRoles.map((role) => this.buildControlImplementationFilter(role));
    return scopedFilters.length ? { OR: scopedFilters } : { id: { equals: '__phase1_no_scope_match__' } };
  }

  async buildRiskReadFilter(userId: string): Promise<Record<string, unknown>> {
    return await this.buildReadFilter(userId, 'risks') as Record<string, unknown>;
  }

  private emptyResolvedScope(): ResolvedScopeConstraints {
    return { legalEntityIds: new Set(), organizationUnitIds: new Set(), scopeIds: new Set(), siteIds: new Set() };
  }

  private asResolvedScope(scope: ScopeConstraints | ResolvedScopeConstraints): ResolvedScopeConstraints {
    if ('legalEntityIds' in scope) return scope;
    return {
      legalEntityIds: new Set(scope.legalEntityId ? [scope.legalEntityId] : []),
      organizationUnitIds: new Set(scope.organizationUnitId ? [scope.organizationUnitId] : []),
      scopeIds: new Set(scope.scopeId ? [scope.scopeId] : []),
      siteIds: new Set(scope.siteId ? [scope.siteId] : []),
    };
  }

  private async resolveScopeSet(scope: ScopeConstraints): Promise<ResolvedScopeConstraints> {
    const scopeIds = await this.findScopeIdsForLegalEntity(scope.legalEntityId);
    if (scope.scopeId) scopeIds.add(scope.scopeId);
    return {
      legalEntityIds: new Set(scope.legalEntityId ? [scope.legalEntityId] : []),
      organizationUnitIds: new Set(scope.organizationUnitId ? [scope.organizationUnitId] : []),
      siteIds: new Set(scope.siteId ? [scope.siteId] : []),
      scopeIds,
    };
  }

  private readPermissionForEntity(entityType: EntityType): PermissionName | null {
    if (entityType === 'administration') return 'administration.access';
    if (entityType === 'costPlanning') return 'bcm.read';
    return READ_PERMISSION_BY_RESOURCE[entityType] ?? null;
  }

  private permissionForAction(entityType: EntityType, action: EntityAction): PermissionName | null {
    const entity = entityType === 'costPlanning' ? 'bcm' : entityType;
    const candidate = action === 'delete' ? `${entity}.write` : action === 'read' ? `${entity}.read` : `${entity}.${action}`;
    if (GRANULAR_PERMISSIONS.includes(candidate as PermissionName)) return candidate as PermissionName;
    if (action === 'write' && WRITE_PERMISSION_BY_RESOURCE[entity]) return WRITE_PERMISSION_BY_RESOURCE[entity];
    return null;
  }
}

export const authorizationService = new AuthorizationService();
