/**
 * Prisma Seed Script – Asset Management System (ISO 27001)
 *
 * Creates initial data for roles, asset types, organization units,
 * risk methods, and a test user.
 *
 * Usage: npx prisma db seed  (requires "seed" script in package.json)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper – upsert by unique field, log what was created
// ---------------------------------------------------------------------------
async function seed<TId extends string, TCreate extends object, TUpdate extends object>(
  model: any,
  where: { id: TId } | Record<string, unknown>,
  create: TCreate,
  update: TUpdate,
  label: string,
): Promise<void> {
  await model.upsert({ where, create, update });
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Built-in Roles
// ---------------------------------------------------------------------------
async function seedRoles(): Promise<void> {
  console.log('\n📋 Seeding roles…');

  await seed(
    prisma.role,
    { name: 'system_admin' },
    {
      name: 'system_admin',
      description: 'Full system access – manages users, roles and all entities',
      isBuiltIn: true,
      permissions: [],
      canAccessAdmin: true,
      entityPermissions: {
        assets: 'readwrite',
        risks: 'readwrite',
        controls: 'readwrite',
        incidents: 'readwrite',
      },
    },
    {},
    'Role: system_admin',
  );

  await seed(
    prisma.role,
    { name: 'ism_manager' },
    {
      name: 'ism_manager',
      description: 'ISMS Manager – admin access with full entity permissions',
      isBuiltIn: true,
      permissions: [],
      canAccessAdmin: true,
      entityPermissions: {
        assets: 'readwrite',
        risks: 'readwrite',
        controls: 'readwrite',
        incidents: 'readwrite',
      },
    },
    {},
    'Role: ism_manager',
  );

  await seed(
    prisma.role,
    { name: 'auditor' },
    {
      name: 'auditor',
      description: 'Internal / External Auditor – read-only on all entities',
      isBuiltIn: true,
      permissions: [],
      canAccessAdmin: false,
      entityPermissions: {
        assets: 'readonly',
        risks: 'readonly',
        controls: 'readonly',
        incidents: 'readonly',
      },
    },
    {},
    'Role: auditor',
  );

  await seed(
    prisma.role,
    { name: 'employee' },
    {
      name: 'employee',
      description: 'Standard employee – read-only access to assets, risks, controls, incidents',
      isBuiltIn: true,
      permissions: [],
      canAccessAdmin: false,
      entityPermissions: {
        assets: 'readonly',
        risks: 'readonly',
        controls: 'readonly',
        incidents: 'readonly',
      },
    },
    {},
    'Role: employee',
  );
}

// ---------------------------------------------------------------------------
// Asset Types (ISO 27001 relevant categories)
// ---------------------------------------------------------------------------
async function seedAssetTypes(): Promise<void> {
  console.log('\n🗄️  Seeding asset types…');

  const assetTypes = [
    // Hardware
    { name: 'physical_server', category: 'hardware' },
    { name: 'client', category: 'hardware' },
    { name: 'virtual_machine', category: 'hardware' },
    { name: 'container', category: 'hardware' },
    { name: 'network_component', category: 'hardware' },
    { name: 'security_component', category: 'hardware' },
    { name: 'mobile_device', category: 'hardware' },
    // Software & Data
    { name: 'application', category: 'software' },
    { name: 'software_product', category: 'software' },
    { name: 'operating_system', category: 'software' },
    { name: 'database', category: 'software' },
    { name: 'data_asset', category: 'data' },
    // Cloud & Services
    { name: 'cloud_resource', category: 'cloud' },
    { name: 'saas_service', category: 'cloud' },
    { name: 'it_service', category: 'service' },
    { name: 'enterprise_service', category: 'service' },
    // Identity & Security
    { name: 'user_account', category: 'identity' },
    { name: 'technical_account', category: 'identity' },
    { name: 'privileged_identity', category: 'identity' },
    { name: 'certificate', category: 'security' },
    { name: 'cryptographic_key', category: 'security' },
    // Business & External
    { name: 'business_process', category: 'business' },
    { name: 'supplier', category: 'external' },
    { name: 'external_service', category: 'external' },
    { name: 'contract', category: 'legal' },
    { name: 'license', category: 'legal' },
    // Facilities & OT
    { name: 'building', category: 'facility' },
    { name: 'room', category: 'facility' },
    { name: 'ot_system', category: 'ot' },
  ];

  for (const at of assetTypes) {
    await seed(
      prisma.assetType,
      { name: at.name },
      {
        name: at.name,
        description: `Asset type: ${at.name.replace(/_/g, ' ')}`,
        category: at.category,
      },
      {},
      `AssetType: ${at.name} (${at.category})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Organisation Units (Demo hierarchy)
// ---------------------------------------------------------------------------
async function seedOrganizationUnits(): Promise<void> {
  console.log('\n🏢 Seeding organization units…');

  const root = await prisma.organizationUnit.upsert({
    where: { id: 'seed-root' }, // will fail on UUID – use name-based approach instead
  });

  // Use findFirst + create pattern since there's no unique name constraint
  const units = [
    { name: 'IT Department', type: 'department', parentId: null },
    { name: 'Development', type: 'department', parentName: 'IT Department' },
    { name: 'Operations', type: 'department', parentName: 'IT Department' },
    { name: 'Security', type: 'department', parentName: 'IT Department' },
    { name: 'Management', type: 'department', parentId: null },
  ];

  const createdParents: Record<string, string> = {};

  for (const unit of units) {
    let parentId = unit.parentId;
    if (unit.parentName) {
      const parent = await prisma.organizationUnit.findFirst({
        where: { name: unit.parentName },
      });
      parentId = parent?.id || null;
    }

    const existing = await prisma.organizationUnit.findFirst({
      where: { name: unit.name, parentId },
    });

    if (!existing) {
      await prisma.organizationUnit.create({
        data: {
          id: `seed-${unit.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: unit.name,
          type: unit.type,
          parentId,
        },
      });
      console.log(`  ✓ OrganizationUnit: ${unit.name}`);
    }
    createdParents[unit.name] = existing?.id || `seed-${unit.name.toLowerCase().replace(/\s+/g, '-')}`;
  }
}

// ---------------------------------------------------------------------------
// Risk Method (ISO 27005 basic 5×5 matrix)
// ---------------------------------------------------------------------------
async function seedRiskMethods(): Promise<void> {
  console.log('\n📊 Seeding risk methods…');

  const existing = await prisma.riskMethod.findFirst({
    where: { displayId: 'RM-ISO27005' },
  });

  if (!existing) {
    await prisma.riskMethod.create({
      data: {
        displayId: 'RM-ISO27005',
        name: 'ISO 27005 Basic Risk Matrix',
        description: 'Standard 5×5 likelihood/impact matrix per ISO 27005',
        version: '1.0.0',
        isActive: true,
        likelihoodScale: {
          name: 'Likelihood',
          levels: [
            { value: 1, label: 'Rare', description: 'Once in >10 years' },
            { value: 2, label: 'Unlikely', description: 'Once in 5-10 years' },
            { value: 3, label: 'Possible', description: 'Once in 1-5 years' },
            { value: 4, label: 'Likely', description: 'Once per year' },
            { value: 5, label: 'Almost Certain', description: 'Multiple times per year' },
          ],
        },
        impactScale: {
          name: 'Impact',
          levels: [
            { value: 1, label: 'Negligible', description: 'Minor disruption, minimal financial loss' },
            { value: 2, label: 'Minor', description: 'Limited disruption, recoverable within 24h' },
            { value: 3, label: 'Moderate', description: 'Significant disruption, 1-7 days recovery' },
            { value: 4, label: 'Major', description: 'Severe disruption, >1 week recovery' },
            { value: 5, label: 'Catastrophic', description: 'Business-threatening, potential loss of operations' },
          ],
        },
        ratingDimensions: ['confidentiality', 'integrity', 'availability'],
        formula: 'likelihood × impact',
        riskClasses: [
          { min: 1, max: 4, level: 'low', color: '#4caf50' },
          { min: 5, max: 9, level: 'medium', color: '#ff9800' },
          { min: 10, max: 16, level: 'high', color: '#f44336' },
          { min: 17, max: 25, level: 'critical', color: '#b71c1c' },
        ],
        acceptanceThresholds: {
          autoAcceptable: 'low',
          requiresApproval: ['medium', 'high'],
          cisoApproval: ['critical'],
        },
      },
    });
    console.log('  ✓ RiskMethod: ISO 27005 Basic (RM-ISO27005)');
  }
}

// ---------------------------------------------------------------------------
// OIDC Config (default / disabled)
// ---------------------------------------------------------------------------
async function seedOidcConfig(): Promise<void> {
  console.log('\n🔐 Seeding OIDC config…');

  const existing = await prisma.oidcConfig.findFirst();
  if (!existing) {
    await prisma.oidcConfig.create({
      data: {
        enabled: false,
        providerName: 'entra_id',
        allowedEmailDomains: [],
        autoProvisioning: false,
        defaultRoleForNewUsers: 'employee',
        enableGroupMapping: false,
        groupClaimToRoleMapping: {},
        enableLocalLogin: true,
      },
    });
    console.log('  ✓ OidcConfig: default (disabled)');
  }
}

// ---------------------------------------------------------------------------
// Intune Sync Config (default)
// ---------------------------------------------------------------------------
async function seedIntuneSyncConfig(): Promise<void> {
  console.log('\n☁️  Seeding Intune sync config…');

  const existing = await prisma.intuneSyncConfig.findFirst();
  if (!existing) {
    await prisma.intuneSyncConfig.create({
      data: {
        enabled: false,
        fullSyncIntervalHours: 24,
        incrementalSyncIntervalMinutes: 120,
        gracePeriodHours: 168,
        maxRetryAttempts: 3,
        retryDelayMs: 5000,
        batchSize: 100,
      },
    });
    console.log('  ✓ IntuneSyncConfig: default (disabled)');
  }
}

// ---------------------------------------------------------------------------
// Test User (for development / testing)
// ---------------------------------------------------------------------------
async function seedTestUser(): Promise<void> {
  console.log('\n👤 Seeding test user…');

  const existing = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin123!@#', 10);

    const orgUnit = await prisma.organizationUnit.findFirst({
      where: { name: 'IT Department' },
    });

    const user = await prisma.user.create({
      data: {
        displayId: 'USR-0001',
        email: 'admin@example.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Administrator',
        isActive: true,
        organizationUnitId: orgUnit?.id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleName: 'system_admin',
      },
    });

    console.log('  ✓ User: admin@example.com (role: system_admin)');
    console.log('    ⚠️  Password: Admin123!@#  (CHANGE IN PRODUCTION!)');
  }

  // Test employee user
  const employee = await prisma.user.findUnique({ where: { email: 'employee@example.com' } });
  if (!employee) {
    const passwordHash = await bcrypt.hash('Employee123!@#', 10);

    const orgUnit = await prisma.organizationUnit.findFirst({
      where: { name: 'Development' },
    });

    const user = await prisma.user.create({
      data: {
        displayId: 'USR-0002',
        email: 'employee@example.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Employee',
        isActive: true,
        organizationUnitId: orgUnit?.id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleName: 'employee',
      },
    });

    console.log('  ✓ User: employee@example.com (role: employee)');
    console.log('    ⚠️  Password: Employee123!@#  (CHANGE IN PRODUCTION!)');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('🌱 Starting database seed…\n');

  try {
    await seedRoles();
    await seedAssetTypes();
    await seedOrganizationUnits();
    await seedRiskMethods();
    await seedOidcConfig();
    await seedIntuneSyncConfig();
    await seedTestUser();

    console.log('\n✅ Seed completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });