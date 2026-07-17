// User and Role types

import { BaseEntity } from './common';

export enum UserRole {
  SYSTEM_ADMIN = 'system_admin',
  ISMS_MANAGER = 'isms_manager',
  ASSET_OWNER = 'asset_owner',
  ASSET_OPERATOR = 'asset_operator',
  RISK_OWNER = 'risk_owner',
  ACTION_OWNER = 'action_owner',
  CONTROL_OWNER = 'control_owner',
  POLICY_OWNER = 'policy_owner',
  INCIDENT_MANAGER = 'incident_manager',
  BCM_OWNER = 'bcm_owner',
  SUPPLIER_OWNER = 'supplier_owner',
  INTERNAL_AUDITOR = 'internal_auditor',
  EXTERNAL_AUDITOR = 'external_auditor',
  MANAGEMENT = 'management',
  EMPLOYEE = 'employee'
}

export type AssetPermissionLevel = 'none' | 'read' | 'read_write';

export interface RolePermission {
  assetType: string;
  level: AssetPermissionLevel;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  permissions: RolePermission[];
  canAccessAdmin: boolean;
  canManageRoles: boolean;
  canManageOptions: boolean;
}

export interface Group extends BaseEntity {
  name: string;
  description?: string;
}

export interface UserGroupAssignment extends BaseEntity {
  userId: string;
  groupId: string;
}

export interface OidcConfig {
  id: string;
  enabled: boolean;
  providerName: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedEmailDomains: string[];
  autoProvisioning: boolean;
  defaultRoleForNewUsers: string;
  enableGroupMapping: boolean;
  groupClaimToRoleMapping: Record<string, string>;
  enableLocalLogin: boolean;
}

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  organizationUnitId?: string;
  roles: string[];
  groups: Group[];
  isActive: boolean;
  lastLoginAt?: Date;
  mustChangePasswordOnNextLogin: boolean;
  passwordChangedAt: Date;
  // OIDC fields
  oidcId?: string;
  oidcProvider?: string;
  isOidcLinked: boolean;
}

export interface UserRoleAssignment extends BaseEntity {
  userId: string;
  roleName: string;
  roleId?: string;
  organizationUnitId?: string;
  scopeId?: string;
  validFrom: Date;
  validUntil?: Date;
}

export interface GroupRoleAssignment extends BaseEntity {
  groupId: string;
  roleName: string;
  roleId?: string;
}
