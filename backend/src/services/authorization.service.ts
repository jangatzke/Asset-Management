import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const GRANULAR_PERMISSIONS = [
  'assets.read', 'assets.write', 'assets.archive',
  'risks.read', 'risks.write', 'risks.assess', 'risks.approve', 'risks.accept',
  'controls.read', 'controls.write', 'controls.test', 'controls.approve',
  'incidents.read', 'incidents.write', 'incidents.assess', 'incidents.report', 'incidents.close',
  'suppliers.read', 'suppliers.write', 'suppliers.approve',
  'bcm.read', 'bcm.write', 'bcm.approve',
  'audits.read', 'audits.write', 'audits.close',
  'correctiveActions.read', 'correctiveActions.write', 'correctiveActions.verify',
  'training.read', 'training.manage',
  'documents.read', 'documents.write', 'documents.approve',
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
  | 'suppliers'
  | 'bcm'
  | 'audits'
  | 'correctiveActions'
  | 'training'
  | 'documents'
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
  validUntil: Date | null;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

type ScopedAssignment = Pick<EffectiveRoleAssignment, 'legalEntityId' | 'organizationUnitId' | 'scopeId' | 'siteId'>;

const LEGACY_ENTITY_PERMISSION_MAP: Record<string, { read: PermissionName; write: PermissionName; archive?: PermissionName }> = {
  assets: { read: 'assets.read', write: 'assets.write', archive: 'assets.archive' },
  risks: { read: 'risks.read', write: 'risks.write' },
  controls: { read: 'controls.read', write: 'controls.write' },
  incidents: { read: 'incidents.read', write: 'incidents.write' },
  costPlanning: { read: 'bcm.read', write: 'bcm.write' },
};

export const WRITE_PERMISSION_BY_RESOURCE: Record<string, PermissionName> = {
  suppliers: 'suppliers.write',
  bias: 'bcm.write',
  bcps: 'bcm.write',
  auditPlans: 'audits.write',
  correctiveActions: 'correctiveActions.write',
  trainingAssignments: 'training.manage',
  documents: 'documents.write',
  evidence: 'evidence.write',
  nis2: 'nis2.write',
  controls: 'controls.write',
  risks: 'risks.write',
  assets: 'assets.write',
  incidents: 'incidents.write',
};

export const READ_PERMISSION_BY_RESOURCE: Record<string, PermissionName> = {
  suppliers: 'suppliers.read',
  bias: 'bcm.read',
  bcps: 'bcm.read',
  auditPlans: 'audits.read',
  correctiveActions: 'correctiveActions.read',
  trainingAssignments: 'training.read',
  documents: 'documents.read',
  evidence: 'evidence.read',
  nis2: 'nis2.read',
  controls: 'controls.read',
  risks: 'risks.read',
  assets: 'assets.read',
  incidents: 'incidents.read',
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
    for (const assignment of directAssignments) roles.push(this.mapAssignment(assignment, assignment.role, assignment.validUntil));
    for (const userGroup of userGroups) {
      for (const groupRole of userGroup.group?.groupRoles ?? []) roles.push(this.mapAssignment(groupRole, groupRole.role, null));
    }
    return roles;
  }

  isRoleActive(role: Pick<EffectiveRoleAssignment, 'validUntil'>): boolean {
    return !role.validUntil || new Date() <= role.validUntil;
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
    if (grantingRoles.length === 0 || !grantingRoles.some((role) => !this.hasScopeConstraint(role) || this.scopeMatches(role, scope))) {
      throw new AppError(`Authorization denied: ${permission} required for target scope`, 403);
    }
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

  private mapAssignment(assignment: any, role: any, validUntil: Date | null): EffectiveRoleAssignment {
    const permissions = new Set<string>();
    for (const rolePermission of role?.rolePermissions ?? []) {
      if (rolePermission.permission?.name) permissions.add(rolePermission.permission.name);
    }

    if (role?.canAccessAdmin || assignment.roleName === 'system_admin') permissions.add('administration.access');
    if (assignment.roleName === 'system_admin') GRANULAR_PERMISSIONS.forEach((permission) => permissions.add(permission));
    this.addLegacyPermissions(permissions, role?.entityPermissions);

    return {
      roleName: assignment.roleName,
      canAccessAdmin: permissions.has('administration.access'),
      permissions,
      validUntil,
      legalEntityId: assignment.legalEntityId ?? null,
      organizationUnitId: assignment.organizationUnitId ?? null,
      scopeId: assignment.scopeId ?? null,
      siteId: assignment.siteId ?? null,
    };
  }

  private addLegacyPermissions(permissions: Set<string>, entityPermissions: unknown): void {
    const legacy = entityPermissions as Record<string, 'none' | 'readonly' | 'readwrite'> | null | undefined;
    if (!legacy) return;
    for (const [entity, level] of Object.entries(legacy)) {
      const mapping = LEGACY_ENTITY_PERMISSION_MAP[entity];
      if (!mapping || level === 'none') continue;
      if (level === 'readonly' || level === 'readwrite') permissions.add(mapping.read);
      if (level === 'readwrite') {
        permissions.add(mapping.write);
        if (mapping.archive) permissions.add(mapping.archive);
      }
    }
  }

  private hasScopeConstraint(role: ScopedAssignment): boolean {
    return Boolean(role.legalEntityId || role.organizationUnitId || role.scopeId || role.siteId);
  }

  private scopeMatches(role: ScopedAssignment, entityScope: ScopeConstraints): boolean {
    if (role.legalEntityId && role.legalEntityId !== entityScope.legalEntityId) return false;
    if (role.organizationUnitId && role.organizationUnitId !== entityScope.organizationUnitId) return false;
    if (role.siteId && role.siteId !== entityScope.siteId) return false;
    if (role.scopeId && role.scopeId !== entityScope.scopeId) return false;
    return true;
  }

  private async resolveEntityScope(entityType: EntityType, entityId: string): Promise<ScopeConstraints> {
    const db = prisma as any;
    if (entityType === 'assets') {
      const asset = await db.asset.findUnique({ where: { id: entityId }, include: { organizationUnit: true, location: { include: { organizationUnit: true } } } });
      if (!asset) throw new AppError('Asset not found', 404);
      const organizationUnitId = asset.organizationUnitId ?? asset.location?.organizationUnitId ?? null;
      const legalEntityId = asset.organizationUnit?.legalEntityId ?? asset.location?.organizationUnit?.legalEntityId ?? null;
      return { legalEntityId, organizationUnitId, siteId: asset.locationId ?? null, scopeId: await this.findScopeForLegalEntity(legalEntityId) };
    }
    if (entityType === 'risks') {
      const risk = await db.risk.findUnique({ where: { id: entityId }, include: { organizationUnit: true } });
      if (!risk) throw new AppError('Risk not found', 404);
      const legalEntityId = risk.organizationUnit?.legalEntityId ?? null;
      return { legalEntityId, organizationUnitId: risk.organizationUnitId ?? null, siteId: null, scopeId: await this.findScopeForLegalEntity(legalEntityId) };
    }
    if (entityType === 'controls') {
      const implementation = await db.controlImplementation.findFirst({ where: { OR: [{ id: entityId }, { controlId: entityId }] }, include: { site: true, organizationUnit: true } });
      const legalEntityId = implementation?.organizationUnit?.legalEntityId ?? implementation?.site?.organizationUnit?.legalEntityId ?? null;
      return { legalEntityId, organizationUnitId: implementation?.organizationUnitId ?? implementation?.site?.organizationUnitId ?? null, siteId: implementation?.siteId ?? null, scopeId: implementation?.scopeId ?? await this.findScopeForLegalEntity(legalEntityId) };
    }
    if (entityType === 'incidents') {
      const incidentAsset = await db.incidentAsset.findFirst({ where: { incidentId: entityId }, include: { asset: { include: { organizationUnit: true, location: { include: { organizationUnit: true } } } } } });
      const legalEntityId = incidentAsset?.asset?.organizationUnit?.legalEntityId ?? incidentAsset?.asset?.location?.organizationUnit?.legalEntityId ?? null;
      return { legalEntityId, organizationUnitId: incidentAsset?.asset?.organizationUnitId ?? incidentAsset?.asset?.location?.organizationUnitId ?? null, siteId: incidentAsset?.asset?.locationId ?? null, scopeId: await this.findScopeForLegalEntity(legalEntityId) };
    }
    return { legalEntityId: null, organizationUnitId: null, siteId: null, scopeId: null };
  }

  private async findScopeForLegalEntity(legalEntityId: string | null): Promise<string | null> {
    if (!legalEntityId) return null;
    const membership = await (prisma as any).ismsScopeLegalEntity.findFirst({ where: { legalEntityId }, select: { scopeId: true } });
    return membership?.scopeId ?? null;
  }

  private buildScopedFilter(entityType: EntityType, role: ScopedAssignment): Record<string, unknown> | null {
    const orgUnitClause = role.organizationUnitId ? { organizationUnitId: role.organizationUnitId } : null;
    const legalEntityOrgClause = role.legalEntityId ? { organizationUnit: { legalEntityId: role.legalEntityId } } : null;
    const siteClause = role.siteId ? { locationId: role.siteId } : null;
    const scopeOrgClause = role.scopeId ? { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: role.scopeId } } } } } : null;

    if (entityType === 'assets') return this.orFilter([orgUnitClause, legalEntityOrgClause, siteClause, scopeOrgClause]);
    if (entityType === 'risks') return this.orFilter([orgUnitClause, legalEntityOrgClause, scopeOrgClause]);
    if (entityType === 'controls') {
      return { implementations: { some: this.orFilter([
        role.organizationUnitId ? { organizationUnitId: role.organizationUnitId } : null,
        role.legalEntityId ? { organizationUnit: { legalEntityId: role.legalEntityId } } : null,
        role.siteId ? { siteId: role.siteId } : null,
        role.scopeId ? { OR: [{ scopeId: role.scopeId }, { organizationUnit: { legalEntity: { ismsScopeMemberships: { some: { scopeId: role.scopeId } } } } }] } : null,
      ]) } };
    }
    if (entityType === 'incidents') {
      return { incidentAssets: { some: { asset: this.orFilter([orgUnitClause, legalEntityOrgClause, siteClause, scopeOrgClause]) } } };
    }
    return this.hasScopeConstraint(role) ? null : {};
  }

  private orFilter(filters: Array<Record<string, unknown> | null>): Record<string, unknown> {
    const active = filters.filter(Boolean) as Record<string, unknown>[];
    if (active.length === 0) return {};
    if (active.length === 1) return active[0];
    return { OR: active };
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
