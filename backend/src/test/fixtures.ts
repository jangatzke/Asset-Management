/**
 * Test Fixtures - Sample data for use in tests
 */

export const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: '$2a$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  phoneNumber: '+491234567890',
  isActive: true,
  lastLoginAt: null as Date | null,
  mustChangePasswordOnNext: false,
  passwordChangedAt: new Date(),
  organizationUnitId: null as string | null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null as string | null,
  updatedBy: null as string | null,
  oidcId: null as string | null,
  oidcProvider: null as string | null,
  displayId: 'USR-001',
};

export const testAdminUser = {
  ...testUser,
  id: 'admin-123',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
};

export const testUserRole = {
  id: 'ur-123',
  userId: 'user-123',
  roleName: 'employee',
  roleId: null as string | null,
  organizationUnitId: null as string | null,
  scopeId: null as string | null,
  validFrom: new Date(),
  validUntil: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testAdminUserRole = {
  ...testUserRole,
  id: 'ur-admin-123',
  userId: 'admin-123',
  roleName: 'system_admin',
};

export const testRole = {
  id: 'role-123',
  name: 'employee',
  description: 'Standard employee role',
  isBuiltIn: true,
  permissions: [] as any,
  canAccessAdmin: false,
  entityPermissions: { assets: 'none', risks: 'none', controls: 'none', incidents: 'none' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testAdminRole = {
  ...testRole,
  id: 'role-admin-123',
  name: 'system_admin',
  description: 'Full system access',
  canAccessAdmin: true,
  entityPermissions: { assets: 'readwrite', risks: 'readwrite', controls: 'readwrite', incidents: 'readwrite' },
};

export const testGroup = {
  id: 'group-123',
  name: 'IT Department',
  description: 'IT staff group',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testUserGroup = {
  id: 'ug-123',
  userId: 'user-123',
  groupId: 'group-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testGroupRole = {
  id: 'gr-123',
  groupId: 'group-123',
  roleName: 'employee',
  roleId: 'role-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testOidcConfig = {
  id: 'oidc-123',
  enabled: true,
  providerName: 'entra_id',
  tenantId: 'tenant-123',
  clientId: 'client-123',
  clientSecret: 'secret-123',
  redirectUri: 'http://localhost:3000/auth/callback',
  allowedEmailDomains: ['example.com'],
  autoProvisioning: true,
  defaultRoleForNewUsers: 'employee',
  enableGroupMapping: false,
  groupClaimToRoleMapping: {},
  enableLocalLogin: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testAssetType = {
  id: 'asset-type-123',
  name: 'Laptop',
  description: 'Laptop computers',
  category: 'Hardware',
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testAsset = {
  id: 'asset-123',
  displayId: 'AST-001',
  name: 'Test Laptop',
  description: 'A test laptop',
  assetTypeId: 'asset-type-123',
  criticality: 'high',
  lifecycleStatus: 'in_use',
  ownerUserId: 'user-123',
  location: 'Office 101',
  serialNumber: 'SN-123',
  purchaseDate: new Date(),
  warrantyExpiry: new Date(),
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'admin-123',
  updatedBy: null as string | null,
};

/**
 * Plain password for test user (hashed version is in testUser.passwordHash)
 * The hash was generated with bcrypt.hash('password123', 10)
 */
export const testUserPassword = 'password123';

/**
 * Password that meets ISO 27001 strength requirements:
 * - 12+ characters, uppercase, lowercase, digit, special char
 */
export const strongTestPassword = 'Str0ng!Pass';
