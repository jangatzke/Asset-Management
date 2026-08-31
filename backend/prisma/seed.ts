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
import dotenv from 'dotenv';
import path from 'node:path';
import { ISO27001_STANDARD_ASSET_TYPES } from '../src/services/bootstrap.service';
import { GRANULAR_PERMISSIONS } from '../src/services/authorization.service';
import { catalogService } from '../src/services/catalog.service';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<string, string[]> = {
  system_admin: [...GRANULAR_PERMISSIONS],
  ism_manager: [...GRANULAR_PERMISSIONS],
  auditor: ['assets.read', 'risks.read', 'controls.read', 'incidents.read', 'suppliers.read', 'bcm.read', 'audits.read', 'correctiveActions.read', 'training.read', 'documents.read', 'interestedParties.read', 'evidence.read', 'nis2.read'],
  employee: ['assets.read', 'risks.read', 'controls.read', 'incidents.read', 'tickets.read', 'training.read', 'documents.read', 'interestedParties.read'],
  ticket_viewer: ['tickets.read', 'serviceCatalog.read'],
  service_desk_agent: ['tickets.read', 'tickets.write', 'tickets.assign', 'tickets.close', 'tickets.escalate', 'serviceCatalog.read'],
  it_manager: ['tickets.read', 'tickets.write', 'tickets.assign', 'tickets.close', 'tickets.escalate', 'tickets.approve', 'serviceCatalog.read'],
  service_catalog_manager: ['tickets.read', 'serviceCatalog.read', 'serviceCatalog.manage'],
};

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

  for (const role of [
    ['ticket_viewer', 'Ticket Viewer – read-only IT service management access'],
    ['service_desk_agent', 'Service Desk Agent – manages tickets and escalations'],
    ['it_manager', 'IT Manager – approves changes and oversees ticket operations'],
    ['service_catalog_manager', 'Service Catalog Manager – maintains the request catalog'],
  ] as const) {
    await seed(prisma.role, { name: role[0] }, { name: role[0], description: role[1], isBuiltIn: true, permissions: [], canAccessAdmin: false, entityPermissions: { tickets: role[0] === 'ticket_viewer' ? 'readonly' : 'readwrite' } }, {}, `Role: ${role[0]}`);
  }

  for (const permission of GRANULAR_PERMISSIONS) {
    await (prisma as any).permission.upsert({
      where: { name: permission },
      create: { name: permission, description: `Phase 1 permission ${permission}` },
      update: { description: `Phase 1 permission ${permission}` },
    });
  }

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const existingRole = await prisma.role.findUnique({ where: { name: roleName } });
    if (!existingRole) continue;
    for (const permissionName of permissions) {
      const permission = await (prisma as any).permission.findUnique({ where: { name: permissionName } });
      await (prisma as any).rolePermission.upsert({
        where: { roleId_permissionId: { roleId: existingRole.id, permissionId: permission.id } },
        create: { roleId: existingRole.id, permissionId: permission.id },
        update: {},
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Asset Types (ISO 27001 relevant categories)
// ---------------------------------------------------------------------------
async function seedAssetTypes(): Promise<void> {
  console.log('\n🗄️  Seeding asset types…');

  const assetTypes = ISO27001_STANDARD_ASSET_TYPES;

  for (const at of assetTypes) {
    await seed(
      prisma.assetType,
      { name: at.name },
      {
        name: at.name,
        description: at.description,
        category: at.category,
        inventoryEnabled: ['Server', 'Workstation', 'Network Device'].includes(at.name),
        inventoryPattern: at.name === 'Server' ? 'SRV####' : at.name === 'Workstation' ? 'NB####' : at.name === 'Network Device' ? 'NET####' : undefined,
      },
      {},
      `AssetType: ${at.name} (${at.category})`,
    );

    const createdType = await prisma.assetType.findUnique({ where: { name: at.name } });
    if (createdType && ['Server', 'Workstation'].includes(at.name)) {
      const subtypeName = at.name === 'Server' ? 'Virtual Machine' : 'Notebook';
      const existingSubtype = await (prisma as any).assetSubtype.findFirst({ where: { assetTypeId: createdType.id, name: subtypeName } });
      if (!existingSubtype) {
        await (prisma as any).assetSubtype.create({
          data: {
            assetTypeId: createdType.id,
            name: subtypeName,
            description: `${subtypeName} inventory subtype`,
            inventoryEnabled: true,
            inventoryPattern: at.name === 'Server' ? 'VM####' : 'NB####',
          },
        });
        console.log(`  ✓ AssetSubtype: ${at.name} / ${subtypeName}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Organisation Units (Demo hierarchy)
// ---------------------------------------------------------------------------
async function seedOrganizationUnits(): Promise<void> {
  console.log('\n🏢 Seeding organization units…');

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
    const riskMethod = await prisma.riskMethod.create({
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
        calculationType: 'product',
        formulaExpression: 'likelihood * impact',
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

    await prisma.riskMethodVersion.create({
      data: {
        riskMethodId: riskMethod.id,
        versionTag: `${riskMethod.version}-snapshot-1`,
        likelihoodScale: riskMethod.likelihoodScale,
        impactScale: riskMethod.impactScale,
        ratingDimensions: riskMethod.ratingDimensions,
        calculationType: riskMethod.calculationType,
        formulaExpression: riskMethod.formulaExpression,
        riskClasses: riskMethod.riskClasses,
        isImmutable: false,
      },
    });
    console.log('  ✓ RiskMethod: ISO 27005 Basic (RM-ISO27005)');
  } else {
    const existingVersion = await prisma.riskMethodVersion.findFirst({
      where: { riskMethodId: existing.id },
    });

    if (!existingVersion) {
      await prisma.riskMethodVersion.create({
        data: {
          riskMethodId: existing.id,
          versionTag: `${existing.version}-snapshot-1`,
          likelihoodScale: existing.likelihoodScale,
          impactScale: existing.impactScale,
          ratingDimensions: existing.ratingDimensions,
          calculationType: existing.calculationType,
          formulaExpression: existing.formulaExpression,
          riskClasses: existing.riskClasses,
          isImmutable: false,
        },
      });
      console.log('  ✓ RiskMethodVersion: ISO 27005 Basic snapshot');
    }
  }
}

async function seedNormalizedRiskControlDemo(): Promise<void> {
  console.log('\n🛡️  Seeding normalized risk-control demo…');
  const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  const methodVersion = await prisma.riskMethodVersion.findFirst();
  const serverType = await prisma.assetType.findFirst({ where: { name: 'Server' } });
  if (!admin || !serverType) return;

  const asset = await prisma.asset.findFirst({ where: { displayId: 'AST-NORM-001' } }) ?? await prisma.asset.create({
    data: {
      displayId: 'AST-NORM-001',
      name: 'Normalized Demo Server',
      assetTypeId: serverType.id,
      inventoryNumber: 'SRV0001',
      lifecycleStatus: 'active',
      criticality: 'high',
      createdBy: admin.id,
    },
  });

  const control = await prisma.control.findFirst({ where: { catalogId: 'ISO27001', title: 'Access Control Demo' } }) ?? await prisma.control.create({
    data: {
      catalogId: 'ISO27001',
      catalogVersion: '2022',
      title: 'Access Control Demo',
      description: 'Demo access control for normalized risk-control chain',
      controlGoal: 'Reduce unauthorized access risk',
      responsibleId: admin.id,
      implementationStatus: 'implemented',
      createdBy: admin.id,
    },
  });

  const implementation = await (prisma as any).controlImplementation.findFirst({ where: { controlId: control.id } }) ?? await (prisma as any).controlImplementation.create({
    data: {
      controlId: control.id,
      responsibleUserId: admin.id,
      implementationStatus: 'implemented',
      maturityLevel: 3,
      implementationDescription: 'MFA enabled on administrative access',
      createdBy: admin.id,
    },
  });

  if (methodVersion) {
    const risk = await prisma.risk.findFirst({ where: { displayId: 'RSK-NORM-001' } }) ?? await prisma.risk.create({
      data: {
        displayId: 'RSK-NORM-001',
        title: 'Unauthorized administrative access',
        description: 'Administrative credentials may be abused',
        possibleImpact: 'Compromise of critical server',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        riskOwnerId: admin.id,
        assessorId: admin.id,
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        evaluationJustification: 'Residual risk is justified by implemented MFA control.',
        riskMethodVersionId: methodVersion.id,
        createdBy: admin.id,
      },
    });
    await prisma.riskAsset.upsert({ where: { riskId_assetId: { riskId: risk.id, assetId: asset.id } }, create: { riskId: risk.id, assetId: asset.id }, update: {} });
    const version = await (prisma as any).riskAssessmentVersion.findFirst({ where: { riskId: risk.id } }) ?? await (prisma as any).riskAssessmentVersion.create({
      data: {
        riskId: risk.id,
        riskMethodVersionId: methodVersion.id,
        versionNumber: 1,
        assessmentType: 'current',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'high',
        residualRisk: 'medium',
        targetRisk: 'low',
        score: 12,
        assessorId: admin.id,
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        justification: 'Assessor-entered residual risk justified by MFA.',
      },
    });
    const rc = await (prisma as any).riskControl.upsert({
      where: { riskId_controlImplementationId: { riskId: risk.id, controlImplementationId: implementation.id } },
      create: { riskId: risk.id, controlImplementationId: implementation.id, role: 'preventive', mitigationDimension: 'likelihood', isKeyControl: true, createdBy: admin.id },
      update: {},
    });
    await (prisma as any).riskControlAssessment.upsert({
      where: { riskControlId_riskAssessmentVersionId: { riskControlId: rc.id, riskAssessmentVersionId: version.id } },
      create: { riskControlId: rc.id, riskAssessmentVersionId: version.id, effectivenessStatus: 'effective', effectivenessRating: 80, likelihoodReduction: 1, impactReduction: 0, justification: 'MFA is tested and effective.', assessedBy: admin.id },
      update: {},
    });
    console.log('  ✓ Normalized RiskControl demo chain');
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

  const ensureRole = async (userId: string, roleName: string): Promise<void> => {
    const existingRole = await prisma.userRole.findFirst({ where: { userId, roleName } });
    if (!existingRole) {
      await prisma.userRole.create({ data: { userId, roleName } });
    }
  };

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: 'admin@example.com' }, { displayId: 'USR-0001' }] },
  });
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

    await ensureRole(user.id, 'system_admin');

    console.log('  ✓ User: admin@example.com (role: system_admin)');
    console.log('    ⚠️  Password: Admin123!@#  (CHANGE IN PRODUCTION!)');
  } else {
    await ensureRole(existing.id, 'system_admin');
  }

  // Test employee user
  const employee = await prisma.user.findFirst({
    where: { OR: [{ email: 'employee@example.com' }, { displayId: 'USR-0002' }] },
  });
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

    await ensureRole(user.id, 'employee');

    console.log('  ✓ User: employee@example.com (role: employee)');
    console.log('    ⚠️  Password: Employee123!@#  (CHANGE IN PRODUCTION!)');
  } else {
    await ensureRole(employee.id, 'employee');
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
    await seedNormalizedRiskControlDemo();
    const isoCatalog = await catalogService.ensureIso27001AnnexA2022Catalog();
    console.log(`  ✓ ISO/IEC 27001:2022 Annex A catalogue (${isoCatalog.items.length} controls)`);

    const nis2Catalog = await catalogService.ensureNis2UmsuCGCatalog();
    console.log(`  ✓ NIS2 obligation catalogue (${nis2Catalog.items.length} Articles)`);

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
