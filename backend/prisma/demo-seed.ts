/**
 * Separate deterministic demo seed for the Asset Management / ISMS application.
 * Run after migrations and the technical base seed: npm run db:seed && npm run db:seed:demo
 *
 * The current schema supports most requested demo modules. Some relations in Phase 6
 * are intentionally FK-like String fields without Prisma relations; this seed still
 * uses valid existing IDs, but cannot rely on referential constraints for those links.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const prisma = new PrismaClient();
const db = prisma as any;
const P = 'demo-helio';
const BASE = new Date('2026-01-15T10:00:00.000Z');
const PASSWORD = 'Demo123!@#';

const id = (s: string) => `${P}-${s}`;
const d = (days: number) => new Date(BASE.getTime() + days * 86_400_000);
const riskClass = (score: number) => (score >= 17 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low');

async function byId(model: any, suffix: string, create: Record<string, unknown>, update: Record<string, unknown> = {}) {
  return model.upsert({ where: { id: id(suffix) }, create: { id: id(suffix), ...create }, update });
}

async function singleton(model: any, where: Record<string, unknown>, create: Record<string, unknown>, update: Record<string, unknown> = {}) {
  const found = await model.findFirst({ where });
  return found ? model.update({ where: { id: found.id }, data: update }) : model.create({ data: create });
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    'select exists(select 1 from information_schema.tables where table_schema=$1 and table_name=$2) as exists',
    'public',
    tableName,
  );
  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    'select exists(select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3) as exists',
    'public',
    tableName,
    columnName,
  );
  return Boolean(rows[0]?.exists);
}

async function safeCount(model: any, where: Record<string, unknown>): Promise<number> {
  try {
    return await model.count({ where });
  } catch {
    return 0;
  }
}

async function requireBaseSeed() {
  const [baseUser, methodVersion, assetType] = await Promise.all([
    prisma.user.findFirst(),
    prisma.riskMethodVersion.findFirst(),
    prisma.assetType.findFirst(),
  ]);
  if (!baseUser || !methodVersion || !assetType) throw new Error('Run the base seed first: npm run db:seed');
  return { baseUser, methodVersion };
}

async function seedOrg() {
  const entities = {
    holding: await byId(prisma.legalEntity, 'le-holding', { name: 'HelioTech Group SE', description: 'Fictitious mid-sized Unternehmensgruppe holding.', taxId: 'DE-HTG-001', address: 'Hafenstraße 12, 20457 Hamburg', country: 'DE' }, { name: 'HelioTech Group SE' }),
    digital: await byId(prisma.legalEntity, 'le-digital', { name: 'HelioTech Digital GmbH', description: 'Shared IT and customer platforms.', taxId: 'DE-HTD-101', address: 'Speicherstadtallee 8, 20457 Hamburg', country: 'DE' }, { name: 'HelioTech Digital GmbH' }),
    factory: await byId(prisma.legalEntity, 'le-factory', { name: 'HelioTech Manufacturing GmbH', description: 'Smart energy device production.', taxId: 'DE-HTM-201', address: 'Industriestraße 44, 80939 München', country: 'DE' }, { name: 'HelioTech Manufacturing GmbH' }),
    services: await byId(prisma.legalEntity, 'le-services', { name: 'HelioTech Services sp. z o.o.', description: 'European field-service and logistics.', taxId: 'PL-HTS-301', address: 'Aleje Jerozolimskie 96, 00-807 Warszawa', country: 'PL' }, { name: 'HelioTech Services sp. z o.o.' }),
  };
  const orgs = {
    holding: await byId(prisma.organizationUnit, 'ou-holding', { name: 'Group Management', type: 'management', legalEntityId: entities.holding.id, description: 'Executive governance.' }, { name: 'Group Management' }),
    it: await byId(prisma.organizationUnit, 'ou-it', { name: 'Group IT & Cloud Operations', type: 'department', legalEntityId: entities.digital.id, parentId: id('ou-holding'), description: 'Infrastructure, cloud, endpoints.' }, { name: 'Group IT & Cloud Operations' }),
    grc: await byId(prisma.organizationUnit, 'ou-grc', { name: 'Information Security & GRC', type: 'department', legalEntityId: entities.digital.id, parentId: id('ou-holding'), description: 'ISMS, risk and assurance.' }, { name: 'Information Security & GRC' }),
    ops: await byId(prisma.organizationUnit, 'ou-ops', { name: 'Customer Operations', type: 'department', legalEntityId: entities.digital.id, parentId: id('ou-holding'), description: 'Support and portal operations.' }, { name: 'Customer Operations' }),
    production: await byId(prisma.organizationUnit, 'ou-production', { name: 'Production & OT', type: 'department', legalEntityId: entities.factory.id, parentId: id('ou-holding'), description: 'MES, OT and warehouse technology.' }, { name: 'Production & OT' }),
    finance: await byId(prisma.organizationUnit, 'ou-finance', { name: 'Finance & Procurement', type: 'department', legalEntityId: entities.holding.id, parentId: id('ou-holding'), description: 'Finance, controlling, procurement.' }, { name: 'Finance & Procurement' }),
    hr: await byId(prisma.organizationUnit, 'ou-hr', { name: 'People & Culture', type: 'department', legalEntityId: entities.holding.id, parentId: id('ou-holding'), description: 'HR and training coordination.' }, { name: 'People & Culture' }),
    logistics: await byId(prisma.organizationUnit, 'ou-logistics', { name: 'Logistics & Field Service', type: 'department', legalEntityId: entities.services.id, parentId: id('ou-holding'), description: 'Spare parts and dispatch.' }, { name: 'Logistics & Field Service' }),
  };
  const hash = await bcrypt.hash(PASSWORD, 10);
  const userSpecs = [
    ['admin', 'demo.admin@heliotech.example', 'Mara', 'Klein', orgs.it.id, 'USR-DEMO-001'],
    ['ciso', 'demo.ciso@heliotech.example', 'Jonas', 'Weber', orgs.grc.id, 'USR-DEMO-002'],
    ['asset', 'demo.asset.owner@heliotech.example', 'Lea', 'Schneider', orgs.it.id, 'USR-DEMO-003'],
    ['risk', 'demo.risk.owner@heliotech.example', 'Nils', 'Bauer', orgs.ops.id, 'USR-DEMO-004'],
    ['auditor', 'demo.auditor@heliotech.example', 'Sofia', 'Hartmann', orgs.grc.id, 'USR-DEMO-005'],
    ['site', 'demo.site.lead@heliotech.example', 'Tobias', 'Richter', orgs.production.id, 'USR-DEMO-006'],
    ['process', 'demo.process.owner@heliotech.example', 'Amelie', 'Vogel', orgs.ops.id, 'USR-DEMO-007'],
    ['employee', 'demo.employee@heliotech.example', 'Emil', 'Fischer', orgs.logistics.id, 'USR-DEMO-008'],
    ['supplier', 'demo.supplier.manager@heliotech.example', 'Clara', 'Wagner', orgs.finance.id, 'USR-DEMO-009'],
    ['bcm', 'demo.bcm.owner@heliotech.example', 'Oskar', 'Brandt', orgs.logistics.id, 'USR-DEMO-010'],
  ] as const;
  const users: Record<string, any> = {};
  for (const [key, email, firstName, lastName, organizationUnitId, displayId] of userSpecs) {
    users[key] = await prisma.user.upsert({ where: { email }, create: { id: id(`user-${key}`), displayId, email, passwordHash: hash, firstName, lastName, organizationUnitId, isActive: true, language: 'en' }, update: { firstName, lastName, organizationUnitId, isActive: true } });
  }
  const sites = {
    hamburg: await byId(prisma.site, 'site-hamburg', { name: 'Hamburg HQ and Cloud Control Center', address: 'Hafenstraße 12', city: 'Hamburg', postalCode: '20457', country: 'DE', organizationUnitId: orgs.it.id, isCritical: true }, { name: 'Hamburg HQ and Cloud Control Center' }),
    munich: await byId(prisma.site, 'site-munich', { name: 'Munich Smart Factory', address: 'Industriestraße 44', city: 'München', postalCode: '80939', country: 'DE', organizationUnitId: orgs.production.id, isCritical: true }, { name: 'Munich Smart Factory' }),
    cologne: await byId(prisma.site, 'site-cologne', { name: 'Cologne Service Desk', address: 'Rheinauhafen 7', city: 'Köln', postalCode: '50678', country: 'DE', organizationUnitId: orgs.ops.id }, { name: 'Cologne Service Desk' }),
    warsaw: await byId(prisma.site, 'site-warsaw', { name: 'Warsaw Logistics Hub', address: 'Aleje Jerozolimskie 96', city: 'Warszawa', postalCode: '00-807', country: 'PL', organizationUnitId: orgs.logistics.id, isCritical: true }, { name: 'Warsaw Logistics Hub' }),
    remote: await byId(prisma.site, 'site-remote', { name: 'Remote Workforce', address: 'Distributed home offices', city: 'Remote', postalCode: '00000', country: 'EU', organizationUnitId: orgs.hr.id }, { name: 'Remote Workforce' }),
  };
  const scope = await byId(prisma.ismsScope, 'scope-primary', { name: 'HelioTech Group ISMS Scope 2026', description: 'Cloud operations, customer portal, production IT/OT interfaces and corporate functions.', includedCompanies: Object.values(entities).map((e: any) => e.name), includedLocations: Object.values(sites).map((s: any) => s.name), includedBusinessProcesses: ['Customer portal operations', 'Smart factory production', 'Field service dispatch'], includedServices: ['Customer Portal', 'ERP Platform', 'Identity Services'], includedAssets: ['production workloads', 'identity platforms', 'endpoints', 'OT gateways'], explicitExclusions: ['prototype lab networks'], exclusionJustifications: { prototypeLab: 'No production or customer data.' }, responsibleUserId: users.ciso.id, approvalStatus: 'approved', validFrom: d(-30), validUntil: d(335), nextReviewDate: d(150), version: '2026.1', createdBy: users.ciso.id }, { responsibleUserId: users.ciso.id, approvalStatus: 'approved' });
  const factoryScope = await byId(prisma.ismsScope, 'scope-factory', { name: 'Munich Factory Extension Scope', description: 'OT integration, MES and factory edge services.', includedCompanies: [entities.factory.name], includedLocations: [sites.munich.name], includedBusinessProcesses: ['Smart factory production'], includedServices: ['Factory MES'], includedAssets: ['OT gateways', 'MES servers'], explicitExclusions: [], exclusionJustifications: {}, responsibleUserId: users.site.id, approvalStatus: 'in_review', validFrom: d(0), nextReviewDate: d(120), version: '0.9', createdBy: users.ciso.id }, { responsibleUserId: users.site.id });
  for (const le of Object.values(entities) as any[]) await prisma.ismsScopeLegalEntity.upsert({ where: { scopeId_legalEntityId: { scopeId: scope.id, legalEntityId: le.id } }, create: { scopeId: scope.id, legalEntityId: le.id }, update: {} });
  await prisma.ismsScopeLegalEntity.upsert({ where: { scopeId_legalEntityId: { scopeId: factoryScope.id, legalEntityId: entities.factory.id } }, create: { scopeId: factoryScope.id, legalEntityId: entities.factory.id }, update: {} });

  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  const assignments = [
    ['ur-admin-global', users.admin.id, 'system_admin', null, null, null, null, d(-60), null],
    ['ur-ciso-scope', users.ciso.id, 'ism_manager', null, null, scope.id, null, d(-30), null],
    ['ur-asset-ou', users.asset.id, 'employee', null, orgs.it.id, null, null, d(-30), null],
    ['ur-risk-le', users.risk.id, 'ism_manager', entities.digital.id, null, null, null, d(-10), null],
    ['ur-auditor-future', users.auditor.id, 'auditor', null, null, scope.id, null, d(20), d(80)],
    ['ur-site-site', users.site.id, 'employee', null, null, null, sites.munich.id, d(-120), null],
    ['ur-employee-expired', users.employee.id, 'employee', entities.services.id, null, null, null, d(-180), d(-5)],
    ['ur-bcm-factory-scope', users.bcm.id, 'ism_manager', null, orgs.logistics.id, factoryScope.id, null, d(-15), null],
  ] as const;
  for (const [suffix, userId, roleName, legalEntityId, organizationUnitId, scopeId, siteId, validFrom, validUntil] of assignments) await byId(prisma.userRole, suffix, { userId, roleName, roleId: roles[roleName], legalEntityId, organizationUnitId, scopeId, siteId, validFrom, validUntil }, { roleId: roles[roleName], validUntil });
  const group = await prisma.group.upsert({ where: { name: 'Demo ISMS Core Team' }, create: { id: id('group-isms'), name: 'Demo ISMS Core Team', description: 'Cross-functional ISMS steering group.' }, update: { description: 'Cross-functional ISMS steering group.' } });
  for (const u of [users.ciso, users.asset, users.risk, users.auditor, users.bcm]) await prisma.userGroup.upsert({ where: { userId_groupId: { userId: u.id, groupId: group.id } }, create: { userId: u.id, groupId: group.id }, update: {} });
  await byId(prisma.groupRole, 'gr-isms', { groupId: group.id, roleName: 'ism_manager', roleId: roles.ism_manager, scopeId: scope.id, validFrom: d(-30) }, { roleId: roles.ism_manager });
  return { entities, orgs, users, sites, scope, factoryScope };
}

async function ensureAssetTypes() {
  const names = ['Server', 'Workstation', 'Network Device', 'Application', 'Database', 'Cloud Service', 'Mobile Device', 'OT System', 'Facility', 'Information'];
  const result: Record<string, any> = {};
  for (const name of names) result[name] = await prisma.assetType.upsert({ where: { name }, create: { name, category: name === 'OT System' ? 'industrial' : 'demo', description: `${name} demo asset type`, inventoryEnabled: ['Server', 'Workstation', 'Network Device'].includes(name), inventoryPattern: `${name.slice(0, 3).toUpperCase()}####` }, update: {} });
  return result;
}

async function seedAssets(ctx: any) {
  const types = await ensureAssetTypes();
  const processSpecs = [
    ['bp-portal', 'BP-DEMO-001', 'Customer Portal Operations', ctx.users.process.id, 'core', 'high'],
    ['bp-factory', 'BP-DEMO-002', 'Smart Factory Production', ctx.users.site.id, 'core', 'critical'],
    ['bp-dispatch', 'BP-DEMO-003', 'Field Service Dispatch', ctx.users.bcm.id, 'core', 'high'],
    ['bp-close', 'BP-DEMO-004', 'Monthly Financial Close', ctx.users.supplier.id, 'supporting', 'medium'],
    ['bp-onboarding', 'BP-DEMO-005', 'Employee Onboarding', ctx.users.employee.id, 'supporting', 'medium'],
  ];
  const processes = [];
  for (const [suffix, displayId, name, processOwner, category, criticality] of processSpecs) processes.push(await byId(prisma.businessProcess, suffix, { displayId, name, description: `Demo process: ${name}`, processOwner, category, criticality, siacControlled: criticality !== 'medium', createdBy: ctx.users.ciso.id }, { name, processOwner }));
  const serviceSpecs = [
    ['svc-portal', 'SVC-DEMO-001', 'Helio Customer Portal', ctx.users.process.id, 'core', 'critical'],
    ['svc-id', 'SVC-DEMO-002', 'Identity and Access Platform', ctx.users.asset.id, 'supporting', 'critical'],
    ['svc-erp', 'SVC-DEMO-003', 'ERP and Finance Platform', ctx.users.supplier.id, 'core', 'high'],
    ['svc-mes', 'SVC-DEMO-004', 'Factory MES Platform', ctx.users.site.id, 'core', 'critical'],
    ['svc-backup', 'SVC-DEMO-005', 'Backup and Recovery Service', ctx.users.asset.id, 'supporting', 'high'],
  ];
  const services = [];
  for (const [suffix, displayId, name, serviceOwner, category, criticality] of serviceSpecs) services.push(await byId(prisma.businessService, suffix, { displayId, name, description: `Demo service: ${name}`, serviceOwner, category, criticality, createdBy: ctx.users.asset.id }, { name, serviceOwner }));

  const assets = [];
  const families = [
    ['Server', 'srv', 34, ctx.orgs.it.id, ctx.sites.hamburg.id, services[0].id, processes[0].id],
    ['Workstation', 'nb', 38, ctx.orgs.ops.id, ctx.sites.remote.id, services[0].id, processes[0].id],
    ['Network Device', 'net', 14, ctx.orgs.it.id, ctx.sites.hamburg.id, services[1].id, processes[0].id],
    ['Application', 'app', 13, ctx.orgs.ops.id, ctx.sites.hamburg.id, services[0].id, processes[0].id],
    ['Database', 'db', 8, ctx.orgs.it.id, ctx.sites.hamburg.id, services[2].id, processes[3].id],
    ['Cloud Service', 'cloud', 7, ctx.orgs.it.id, ctx.sites.hamburg.id, services[4].id, processes[0].id],
    ['Mobile Device', 'mob', 8, ctx.orgs.logistics.id, ctx.sites.warsaw.id, services[3].id, processes[2].id],
    ['OT System', 'ot', 10, ctx.orgs.production.id, ctx.sites.munich.id, services[3].id, processes[1].id],
    ['Facility', 'fac', 4, ctx.orgs.production.id, ctx.sites.munich.id, services[3].id, processes[1].id],
    ['Information', 'info', 6, ctx.orgs.grc.id, ctx.sites.cologne.id, services[1].id, processes[4].id],
  ] as const;
  let n = 1;
  for (const [typeName, short, count, ou, site, serviceId, processId] of families) {
    for (let i = 1; i <= count; i += 1) {
      const criticality = i % 11 === 0 ? 'critical' : i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low';
      const lifecycleStatus = i % 17 === 0 ? 'retired' : i % 13 === 0 ? 'planned' : 'active';
      const asset = await prisma.asset.upsert({
        where: { displayId: `AST-DEMO-${String(n).padStart(3, '0')}` },
        create: { id: id(`asset-${String(n).padStart(3, '0')}`), displayId: `AST-DEMO-${String(n).padStart(3, '0')}`, name: `Helio ${typeName} ${String(i).padStart(2, '0')}`, description: `${typeName} in the HelioTech demo environment.`, assetTypeId: types[typeName].id, inventoryNumber: `HT-${short.toUpperCase()}-${String(i).padStart(4, '0')}`, manufacturer: typeName === 'Server' ? 'Dell' : typeName === 'Network Device' ? 'Cisco' : typeName === 'OT System' ? 'Siemens' : 'Lenovo', model: `Demo-${short.toUpperCase()}-${i}`, serialNumber: `SN-DEMO-${short}-${String(i).padStart(4, '0')}`, organizationUnitId: ou, locationId: site, technicalOperatorId: ctx.users.asset.id, businessOwnerId: i % 2 === 0 ? ctx.users.process.id : ctx.users.risk.id, informationSecurityResponsibleId: ctx.users.ciso.id, lifecycleStatus, commissioningDate: d(-600 + i), endOfSupportDate: d(500 + i), confidentialityNeed: criticality === 'critical' ? 'high' : i % 2 ? 'medium' : 'low', integrityNeed: i % 3 === 0 ? 'high' : 'medium', availabilityNeed: ['Server', 'Network Device', 'OT System'].includes(typeName) ? 'high' : 'medium', dataProtectionRelevance: i % 5 === 0, criticality, complianceRelevance: criticality === 'high' || criticality === 'critical', status: lifecycleStatus === 'retired' ? 'inactive' : 'active', createdBy: ctx.users.asset.id },
        update: { lifecycleStatus, criticality, organizationUnitId: ou, locationId: site },
      });
      assets.push(asset);
      if (i <= 3) await prisma.networkAddress.upsert({ where: { id: id(`netaddr-${String(n).padStart(3, '0')}`) }, create: { id: id(`netaddr-${String(n).padStart(3, '0')}`), assetId: asset.id, address: `10.${n % 250}.${i}.10`, type: 'ipv4', primary: true }, update: { address: `10.${n % 250}.${i}.10` } });
      await prisma.assetProcess.upsert({ where: { assetId_processId: { assetId: asset.id, processId } }, create: { assetId: asset.id, processId }, update: {} });
      await prisma.assetService.upsert({ where: { assetId_serviceId: { assetId: asset.id, serviceId } }, create: { assetId: asset.id, serviceId }, update: {} });
      if (n <= 20) await byId(db.assetLifecycleLog, `life-${String(n).padStart(3, '0')}`, { assetId: asset.id, previousStatus: 'planned', newStatus: lifecycleStatus, changedAt: d(-500 + n), changedByUserId: ctx.users.asset.id, reason: 'Demo lifecycle history' }, { newStatus: lifecycleStatus });
      n += 1;
    }
  }
  const relationPairs = [[1, 35, 'hosts'], [2, 36, 'hosts'], [3, 78, 'stores_data_for'], [4, 89, 'depends_on'], [20, 91, 'monitors'], [88, 90, 'feeds'], [104, 52, 'protects'], [12, 58, 'backs_up']];
  for (const [a, b, type] of relationPairs) await byId(prisma.assetRelation, `rel-${a}-${b}`, { sourceAssetId: assets[a - 1].id, targetAssetId: assets[b - 1].id, relationshipType: type, description: `Demo dependency: asset ${a} ${type} asset ${b}`, createdBy: ctx.users.asset.id }, { relationshipType: type });
  return { assets, processes, services };
}

async function seedControlsRisks(ctx: any, domain: any, methodVersion: any) {
  const controls = [];
  const specs = [
    ['ctrl-mfa', 'ISO27001-A.5.17', 'Identity and MFA enforcement', 'Reduce unauthorized access through MFA and lifecycle controls.'],
    ['ctrl-backup', 'ISO27001-A.8.13', 'Backup and restore assurance', 'Ensure recoverability through tested backups.'],
    ['ctrl-logging', 'ISO27001-A.8.15', 'Central security logging', 'Detect security-relevant events across platforms.'],
    ['ctrl-vuln', 'ISO27001-A.8.8', 'Technical vulnerability management', 'Identify and remediate vulnerabilities in time.'],
    ['ctrl-supplier', 'ISO27001-A.5.19', 'Supplier security governance', 'Control outsourced services and third-party access.'],
    ['ctrl-bcp', 'ISO27001-A.5.30', 'ICT readiness for business continuity', 'Maintain exercised recovery arrangements.'],
    ['ctrl-otseg', 'ISO27001-A.8.22', 'OT network segregation', 'Separate factory networks from enterprise IT.'],
    ['ctrl-awareness', 'ISO27001-A.6.3', 'Security awareness training', 'Maintain employee awareness and acknowledgement.'],
  ];
  for (const [suffix, catalogId, title, controlGoal] of specs) {
    const c = await byId(prisma.control, suffix, { catalogId, catalogVersion: '2022', title, description: `${title} for HelioTech demo scope.`, controlGoal, responsibleId: ctx.users.ciso.id, applicability: 'applicable', applicabilityJustification: 'Required for the approved ISMS scope.', implementationStatus: suffix === 'ctrl-otseg' ? 'in_progress' : 'implemented', maturityLevel: suffix === 'ctrl-otseg' ? 2 : 3, implementationDescription: 'Seeded demo control with planned/current effectiveness semantics.', testMethod: 'sample_and_interview', testFrequency: 'quarterly', lastEffectivenessReview: d(-30), nextTestDate: d(60), createdBy: ctx.users.ciso.id }, { implementationStatus: suffix === 'ctrl-otseg' ? 'in_progress' : 'implemented' });
    controls.push(c);
    await prisma.controlProcess.upsert({ where: { controlId_processId: { controlId: c.id, processId: domain.processes[0].id } }, create: { controlId: c.id, processId: domain.processes[0].id }, update: {} });
    await prisma.controlSite.upsert({ where: { controlId_siteId: { controlId: c.id, siteId: ctx.sites.hamburg.id } }, create: { controlId: c.id, siteId: ctx.sites.hamburg.id }, update: {} });
  }
  const implementations = [];
  for (let i = 0; i < controls.length; i += 1) {
    implementations.push(await byId(prisma.controlImplementation, `impl-${i + 1}`, { controlId: controls[i].id, scopeId: i === 6 ? ctx.factoryScope.id : ctx.scope.id, organizationUnitId: i === 6 ? ctx.orgs.production.id : ctx.orgs.grc.id, siteId: i === 6 ? ctx.sites.munich.id : ctx.sites.hamburg.id, responsibleUserId: i === 6 ? ctx.users.site.id : ctx.users.ciso.id, implementationStatus: i === 6 ? 'in_progress' : 'implemented', maturityLevel: i === 6 ? 2 : 3, implementationDescription: `Operational implementation for ${controls[i].title}.`, testMethod: 'evidence_review', testFrequency: 'quarterly', lastTestDate: d(-20 + i), nextTestDate: d(70 + i), findingsSummary: i === 6 ? 'Firewall rule recertification incomplete.' : 'No material exceptions.', actionsSummary: i === 6 ? 'Complete OT rule recertification.' : 'Continue periodic testing.', createdBy: ctx.users.ciso.id }, { maturityLevel: i === 6 ? 2 : 3 }));
  }
  const evidences = [];
  for (let i = 0; i < 10; i += 1) evidences.push(await byId(prisma.evidence, `evidence-${i + 1}`, { title: `Demo evidence package ${i + 1}`, description: 'Deterministic demo evidence for control and risk workflows.', evidenceType: i % 2 ? 'report' : 'screenshot', source: 'demo-seed', createdBy: ctx.users.auditor.id, validFrom: d(-60), validUntil: d(180), classification: i % 3 ? 'internal' : 'confidential', responsibleId: ctx.users.ciso.id, fileHash: `demo-hash-${i + 1}`, fileName: `demo-evidence-${i + 1}.pdf`, mimeType: 'application/pdf', fileSize: 1024 + i, retentionPeriod: 'P3Y' }, { title: `Demo evidence package ${i + 1}` }));
  for (let i = 0; i < implementations.length; i += 1) {
    const test = await byId(prisma.controlTest, `ctest-${i + 1}`, { controlImplementationId: implementations[i].id, testType: 'operating_effectiveness', testMethod: 'sample_and_reperform', testedBy: ctx.users.auditor.id, testedAt: d(-10 + i), result: i === 6 ? 'partial' : 'passed', effectivenessRating: i === 6 ? 60 : 85 + (i % 10), findings: i === 6 ? 'OT exception workflow lacks timely recertification evidence.' : 'Sample passed.', evidenceRequired: true, nextTestDate: d(80 + i), createdBy: ctx.users.auditor.id }, { result: i === 6 ? 'partial' : 'passed' });
    await prisma.evidenceLink.upsert({ where: { evidenceId_entityType_entityId: { evidenceId: evidences[i % evidences.length].id, entityType: 'control_test', entityId: test.id } }, create: { evidenceId: evidences[i % evidences.length].id, entityType: 'control_test', entityId: test.id, relationType: 'supports', controlTestId: test.id, createdBy: ctx.users.auditor.id }, update: { controlTestId: test.id } });
  }
  const threats = [];
  for (const [suffix, displayId, name, category] of [['thr-ransom', 'THR-DEMO-001', 'Ransomware campaign', 'malware'], ['thr-cloud', 'THR-DEMO-002', 'Cloud account takeover', 'identity'], ['thr-supplier', 'THR-DEMO-003', 'Supplier outage', 'third_party'], ['thr-ot', 'THR-DEMO-004', 'OT network intrusion', 'industrial']] as const) threats.push(await byId(prisma.threat, suffix, { displayId, name, description: `${name} scenario.`, category, source: 'demo threat catalogue', createdBy: ctx.users.ciso.id }, { name }));
  const vulns = [];
  for (const [suffix, displayId, name, severity] of [['vuln-patch', 'VUL-DEMO-001', 'Delayed patching on exposed systems', 'high'], ['vuln-mfa', 'VUL-DEMO-002', 'Legacy service without MFA', 'medium'], ['vuln-contract', 'VUL-DEMO-003', 'Weak supplier exit clauses', 'medium'], ['vuln-otflat', 'VUL-DEMO-004', 'Flat OT network segment', 'high']] as const) vulns.push(await byId(prisma.vulnerability, suffix, { displayId, name, description: `${name} vulnerability.`, category: 'demo', severity, cvssScore: severity === 'high' ? 8.1 : 5.6, createdBy: ctx.users.ciso.id }, { severity }));
  const scenarios = [];
  for (let i = 0; i < threats.length; i += 1) scenarios.push(await byId(prisma.riskScenario, `scenario-${i + 1}`, { displayId: `RSC-DEMO-00${i + 1}`, title: `${threats[i].name} via ${vulns[i].name}`, description: 'Connected demo risk scenario.', threatId: threats[i].id, vulnerabilityId: vulns[i].id, createdBy: ctx.users.ciso.id }, { title: `${threats[i].name} via ${vulns[i].name}` }));
  const risks = [];
  const riskSpecs = [
    ['risk-ransom', 'RSK-DEMO-001', 'Ransomware disrupts customer portal and ERP', 4, 5, domain.processes[0].id, domain.services[0].id, [0, 1, 2], 1],
    ['risk-cloud', 'RSK-DEMO-002', 'Privileged cloud account compromise', 3, 5, domain.processes[0].id, domain.services[1].id, [3, 4, 5], 0],
    ['risk-supplier', 'RSK-DEMO-003', 'Critical supplier outage delays field service', 3, 4, domain.processes[2].id, domain.services[4].id, [80, 81, 82], 4],
    ['risk-ot', 'RSK-DEMO-004', 'OT lateral movement stops production line', 4, 5, domain.processes[1].id, domain.services[3].id, [99, 100, 101], 6],
    ['risk-privacy', 'RSK-DEMO-005', 'Unauthorized export of customer personal data', 3, 4, domain.processes[0].id, domain.services[0].id, [70, 71, 72], 2],
    ['risk-backup', 'RSK-DEMO-006', 'Backup restore fails during disaster recovery', 2, 5, domain.processes[3].id, domain.services[4].id, [6, 7, 8], 1],
  ] as const;
  for (let i = 0; i < riskSpecs.length; i += 1) {
    const [suffix, displayId, title, likelihood, impact, processId, serviceId, assetIndexes, implIndex] = riskSpecs[i];
    const inherent = riskClass(likelihood * impact);
    const residual = riskClass(Math.max(1, (likelihood - 1) * impact));
    const risk = await byId(prisma.risk, suffix, { displayId, title, description: `Demo risk: ${title}`, organizationUnitId: i === 3 ? ctx.orgs.production.id : ctx.orgs.ops.id, threatId: threats[i % threats.length].id, vulnerabilityId: vulns[i % vulns.length].id, possibleImpact: 'Operational, financial, compliance and reputational impact.', likelihood, impact, inherentRisk: inherent, residualRisk: residual, targetRisk: i === 3 ? 'medium' : 'low', riskOwnerId: i === 3 ? ctx.users.site.id : ctx.users.risk.id, assessorId: ctx.users.ciso.id, assessmentDate: d(-80 + i), nextReviewDate: d(100 + i), evaluationJustification: 'Demo assessment based on connected assets, controls and known incidents.', businessProcessId: processId, status: i === 2 ? 'accepted' : 'treatment_in_progress', riskMethodVersionId: methodVersion.id, scenarioId: scenarios[i % scenarios.length].id, createdBy: ctx.users.ciso.id }, { status: i === 2 ? 'accepted' : 'treatment_in_progress' });
    risks.push(risk);
    await prisma.riskProcess.upsert({ where: { riskId_processId: { riskId: risk.id, processId } }, create: { riskId: risk.id, processId }, update: {} });
    await prisma.riskService.upsert({ where: { riskId_serviceId: { riskId: risk.id, serviceId } }, create: { riskId: risk.id, serviceId }, update: {} });
    for (const ai of assetIndexes) await prisma.riskAsset.upsert({ where: { riskId_assetId: { riskId: risk.id, assetId: domain.assets[ai].id } }, create: { riskId: risk.id, assetId: domain.assets[ai].id }, update: {} });
    const current = await db.riskAssessmentVersion.upsert({ where: { riskId_versionNumber: { riskId: risk.id, versionNumber: 1 } }, create: { riskId: risk.id, riskMethodVersionId: methodVersion.id, versionNumber: 1, assessmentType: 'current', likelihood, impact, inherentRisk: inherent, residualRisk: residual, targetRisk: i === 3 ? 'medium' : 'low', score: likelihood * impact, assessorId: ctx.users.ciso.id, assessedAt: d(-70 + i), nextReviewDate: d(100 + i), justification: 'Initial current-state assessment.', status: 'approved', isCurrent: true }, update: { likelihood, impact, residualRisk: residual, isCurrent: true } });
    await db.riskAssessmentVersion.upsert({ where: { riskId_versionNumber: { riskId: risk.id, versionNumber: 2 } }, create: { riskId: risk.id, riskMethodVersionId: methodVersion.id, versionNumber: 2, assessmentType: 'planned', likelihood: Math.max(1, likelihood - 1), impact, inherentRisk: inherent, residualRisk: riskClass(Math.max(1, (likelihood - 2) * impact)), targetRisk: i === 3 ? 'medium' : 'low', score: Math.max(1, (likelihood - 1) * impact), assessorId: ctx.users.ciso.id, assessedAt: d(-40 + i), nextReviewDate: d(150 + i), justification: 'Planned-state assessment after treatment actions.', status: 'draft', isCurrent: false }, update: { isCurrent: false } });
    const rc = await db.riskControl.upsert({ where: { riskId_controlImplementationId: { riskId: risk.id, controlImplementationId: implementations[implIndex].id } }, create: { riskId: risk.id, controlImplementationId: implementations[implIndex].id, role: i === 3 ? 'preventive' : 'detective', mitigationDimension: i === 3 ? 'both' : 'likelihood', isKeyControl: i < 4, createdBy: ctx.users.ciso.id }, update: { isKeyControl: i < 4 } });
    const rca = await db.riskControlAssessment.upsert({ where: { riskControlId_riskAssessmentVersionId: { riskControlId: rc.id, riskAssessmentVersionId: current.id } }, create: { riskControlId: rc.id, riskAssessmentVersionId: current.id, effectivenessStatus: i === 3 ? 'partially_effective' : 'effective', effectivenessRating: i === 3 ? 60 : 82, likelihoodReduction: 1, impactReduction: i === 3 ? 1 : 0, justification: 'Effectiveness derived from demo control test evidence.', assessedBy: ctx.users.auditor.id, assessedAt: d(-8 + i), status: 'approved' }, update: { effectivenessRating: i === 3 ? 60 : 82 } });
    await prisma.evidenceLink.upsert({ where: { evidenceId_entityType_entityId: { evidenceId: evidences[(i + 2) % evidences.length].id, entityType: 'risk_control_assessment', entityId: rca.id } }, create: { evidenceId: evidences[(i + 2) % evidences.length].id, entityType: 'risk_control_assessment', entityId: rca.id, relationType: 'supports', riskControlAssessmentId: rca.id, createdBy: ctx.users.auditor.id }, update: { riskControlAssessmentId: rca.id } });
    const treatment = await byId(prisma.riskTreatment, `treatment-${i + 1}`, { displayId: `TRT-DEMO-00${i + 1}`, riskId: risk.id, assessmentId: current.id, treatmentOption: i === 2 ? 'accept' : 'reduce', plannedActions: i === 2 ? 'Accept residual supplier outage risk with documented exit plan.' : 'Implement additional control improvements and retest.', responsibleUserId: i === 3 ? ctx.users.site.id : ctx.users.risk.id, budget: 20_000 + i * 7_500, targetDate: d(120 + i), expectedReduction: 'Residual risk reduced by one class where practical.', dependencies: 'Supplier, IT operations and process owner availability.', implementationStatus: i === 0 ? 'in_progress' : i === 2 ? 'accepted' : 'planned', justification: i === 2 ? 'Temporary acceptance due to low cost-effective mitigation options.' : null, expiryDate: i === 2 ? d(180) : null, approvedByUserId: i === 2 ? ctx.users.ciso.id : null }, { implementationStatus: i === 0 ? 'in_progress' : i === 2 ? 'accepted' : 'planned' });
    if (i === 2) await db.riskAcceptance.upsert({ where: { treatmentId: treatment.id }, create: { treatmentId: treatment.id, riskId: risk.id, assessmentId: current.id, justification: 'Temporary acceptance until supplier dual-sourcing review.', expiryDate: d(180), requestedBy: ctx.users.risk.id, requiredLevel: 'management', status: 'approved', approvedBy: ctx.users.ciso.id, approvedAt: d(-5) }, update: { status: 'approved', expiryDate: d(180) } });
    await byId(db.riskTreatmentApproval, `approval-${i + 1}`, { treatmentId: treatment.id, approverId: ctx.users.ciso.id, approvalLevel: i === 2 ? 'management' : 'risk_owner', decision: 'approved', comment: 'Demo approval path.', decidedAt: d(-4 + i) }, { decision: 'approved' });
    await byId(db.riskTreatmentEffectivenessReview, `review-${i + 1}`, { treatmentId: treatment.id, result: i === 0 ? 'pending_retest' : 'not_due', reviewDate: d(45 + i), reviewerId: ctx.users.auditor.id, notes: 'Scheduled deterministic demo treatment review.' }, { result: i === 0 ? 'pending_retest' : 'not_due' });
    await byId(db.treatmentAction, `taction-${i + 1}`, { treatmentId: treatment.id, controlImplementationId: implementations[implIndex].id, actionType: 'control_improvement', title: `Improve treatment for ${displayId}`, description: 'Concrete remediation task connected to control implementation.', responsibleUserId: i === 3 ? ctx.users.site.id : ctx.users.asset.id, targetDate: d(90 + i), status: i === 0 ? 'in_progress' : 'planned', createdBy: ctx.users.risk.id }, { status: i === 0 ? 'in_progress' : 'planned' });
    await byId(db.reviewTask, `risk-review-${i + 1}`, { displayId: `REV-DEMO-00${i + 1}`, riskId: risk.id, scheduledDate: d(90 + i), dueDate: d(100 + i), status: i === 1 ? 'in_progress' : 'pending', priority: inherent === 'critical' ? 'critical' : 'high', assignedTo: ctx.users.risk.id, triggerType: 'scheduled', notes: 'Quarterly demo risk review.', createdBy: ctx.users.ciso.id }, { status: i === 1 ? 'in_progress' : 'pending' });
  }
  return { controls, implementations, evidences, risks };
}

async function seedPhase6(ctx: any, domain: any, riskDomain: any) {
  const tables = {
    supplierAssessments: await tableExists('supplier_assessments'),
    supplierRiskRelations: await tableExists('supplier_risk_relations'),
    supplierContractRelations: await tableExists('supplier_contract_relations'),
    correctiveActions: (await tableExists('corrective_actions')) && (await columnExists('corrective_actions', 'displayId')),
    auditPrograms: (await tableExists('audit_programs')) && (await columnExists('audit_programs', 'displayId')),
    trainingCourses: (await tableExists('training_courses')) && (await columnExists('training_courses', 'displayId')),
    biaAssetRelations: await tableExists('bia_asset_relations'),
    businessImpactAnalyses: (await tableExists('business_impact_analyses')) && (await columnExists('business_impact_analyses', 'displayId')),
    businessContinuityPlans: (await tableExists('business_continuity_plans')) && (await columnExists('business_continuity_plans', 'displayId')),
    managementReviews: (await tableExists('management_reviews')) && (await columnExists('management_reviews', 'displayId')),
    securityObjectives: (await tableExists('security_objectives')) && (await columnExists('security_objectives', 'displayId')),
  };
  const suppliers = [];
  for (const [i, name, crit] of [[1, 'NordCloud Managed Services GmbH', 'critical'], [2, 'SecuPen Testlab AG', 'high'], [3, 'Baltic Spare Parts sp. z o.o.', 'medium'], [4, 'Contoso Facility Services GmbH', 'medium']] as const) {
    const s = await byId(prisma.supplier, `supplier-${i}`, { displayId: `SUP-DEMO-00${i}`, legalName: name, description: 'Demo supplier with security assessment.', contactPerson: `Supplier Contact ${i}`, contactEmail: `supplier${i}@example.invalid`, servicesProvided: i === 1 ? 'Cloud operations and backup support' : i === 2 ? 'Penetration testing' : i === 3 ? 'Spare parts logistics' : 'Facility operations', criticality: crit, dataProtectionRelevant: i <= 2, nis2Relevant: i <= 3, securityRequirements: { mfa: true, incidentNoticeHours: 24, iso27001Preferred: true }, certifications: ['ISO 27001 statement', 'TISAX self assessment'], exitStrategy: 'Transition plan and escrow information documented.', assessmentScore: 70 + i * 5, assessmentRating: i === 1 ? 'high' : 'medium', lastReviewDate: d(-90 + i), nextReviewDate: d(180 + i), createdBy: ctx.users.supplier.id }, { criticality: crit });
    suppliers.push(s);
    if (tables.supplierAssessments) await byId(db.supplierAssessment, `supplier-assessment-${i}`, { supplierId: s.id, assessorId: ctx.users.supplier.id, assessmentDate: d(-45 + i), assessmentType: i === 1 ? 'annual' : 'initial', questionnaire: { accessControl: 'implemented', incidentProcess: 'documented', subcontractors: i === 3 ? 'partially documented' : 'approved' }, score: 70 + i * 5, rating: i === 1 ? 'high' : 'medium', findings: [{ severity: i === 1 ? 'medium' : 'low', title: 'Improve evidence freshness' }], actions: [{ title: 'Provide updated SOC report', due: d(60).toISOString() }], status: 'approved', nextAssessmentDate: d(180 + i), approvedBy: ctx.users.ciso.id, approvedAt: d(-10) }, { score: 70 + i * 5 });
    if (tables.supplierRiskRelations && riskDomain.risks[i % riskDomain.risks.length]) await db.supplierRiskRelation.upsert({ where: { supplierId_riskId: { supplierId: s.id, riskId: riskDomain.risks[i % riskDomain.risks.length].id } }, create: { supplierId: s.id, riskId: riskDomain.risks[i % riskDomain.risks.length].id, relationType: 'affected_by', createdBy: ctx.users.supplier.id }, update: {} });
  }
  for (let i = 1; i <= 4; i += 1) {
    const contract = await byId(prisma.contract, `contract-${i}`, { displayId: `CON-DEMO-00${i}`, title: `Demo supplier contract ${i}`, description: 'Supplier contract used by demo assets and services.', contractType: i === 1 ? 'cloud_services' : 'support', supplierId: suppliers[i - 1].id, startDate: d(-365), endDate: d(365), renewalDate: d(300), value: 75_000 + i * 15_000, currency: 'EUR', createdBy: ctx.users.supplier.id }, { title: `Demo supplier contract ${i}` });
    if (tables.supplierContractRelations) await db.supplierContractRelation.upsert({ where: { supplierId_contractId: { supplierId: suppliers[i - 1].id, contractId: contract.id } }, create: { supplierId: suppliers[i - 1].id, contractId: contract.id, relationType: 'primary', createdBy: ctx.users.supplier.id }, update: {} });
    if (domain.assets[i]) await prisma.assetContract.upsert({ where: { assetId_contractId: { assetId: domain.assets[i].id, contractId: contract.id } }, create: { assetId: domain.assets[i].id, contractId: contract.id }, update: {} });
  }
  const incident = await byId(prisma.incident, 'incident-ransom', { displayId: 'INC-DEMO-001', title: 'Suspected ransomware encryption on application cluster', description: 'Full workflow demo incident with assessment, deadline, report, communication and escalation.', detectionTime: d(-12), knowledgeTime: d(-12), reporterId: ctx.users.employee.id, reporterSource: 'service desk', confidentialityImpact: 'medium', integrityImpact: 'high', availabilityImpact: 'high', operationalImpact: 'Customer portal unavailable for 90 minutes.', financialImpact: 45_000, legalImpact: 'NIS2 significance assessed.', personalDataImpact: true, affectedCustomers: ['B2B customer segment A'], affectedThirdParties: ['NordCloud Managed Services GmbH'], suspectedCause: 'Compromised admin token', isIntentional: true, hasCrossBorderImpact: true, indicatorsOfCompromise: ['suspicious powershell command', 'unexpected encryption process'], immediateActions: ['isolate nodes', 'disable token', 'restore clean snapshot'], incidentManagerId: ctx.users.ciso.id, status: 'closed', severity: 'high', notificationStatus: 'submitted', isSignificant: true, significanceReasons: ['service disruption', 'cross-border dependency'], rootCause: 'Legacy automation token lacked conditional access.', lessonsLearned: 'Rotate automation credentials and remove legacy exemptions.', measuresEvaluation: 'Controls effective after token revocation and restore test.', closureSummary: 'Incident contained and reported; corrective action opened.', closedAt: d(-7), closedBy: ctx.users.ciso.id, createdBy: ctx.users.employee.id }, { status: 'closed', notificationStatus: 'submitted' });
  await prisma.incidentAsset.upsert({ where: { incidentId_assetId: { incidentId: incident.id, assetId: domain.assets[0].id } }, create: { incidentId: incident.id, assetId: domain.assets[0].id }, update: {} });
  await prisma.incidentService.upsert({ where: { incidentId_serviceId: { incidentId: incident.id, serviceId: domain.services[0].id } }, create: { incidentId: incident.id, serviceId: domain.services[0].id }, update: {} });
  await prisma.incidentProcess.upsert({ where: { incidentId_processId: { incidentId: incident.id, processId: domain.processes[0].id } }, create: { incidentId: incident.id, processId: domain.processes[0].id }, update: {} });
  const rule = await prisma.nis2IncidentSignificanceRuleVersion.upsert({ where: { version: 'demo-2026.1' }, create: { id: id('nis2-rule'), version: 'demo-2026.1', rules: { availabilityHours: 1, crossBorder: true, personalData: true }, effectiveFrom: d(-365), createdBy: ctx.users.ciso.id }, update: { rules: { availabilityHours: 1, crossBorder: true, personalData: true } } });
  await db.incidentAssessment.upsert({ where: { incidentId: incident.id }, create: { incidentId: incident.id, assessorId: ctx.users.ciso.id, isReportable: true, reportingJustification: 'Availability disruption and cross-border impact meet demo threshold.', significanceRuleVersionId: rule.id, evaluatedRules: { availability: true, personalData: true }, status: 'active', createdBy: ctx.users.ciso.id }, update: { isReportable: true, significanceRuleVersionId: rule.id } });
  for (const [type, off, status] of [['early_warning', -11, 'sent'], ['incident_notification', -10, 'sent'], ['final_report', 20, 'pending']] as const) await db.notificationDeadline.upsert({ where: { incidentId_notificationType: { incidentId: incident.id, notificationType: type } }, create: { incidentId: incident.id, notificationType: type, deadlineDate: d(off), knowledgeTimeReference: d(-12), status, sentAt: status === 'sent' ? d(off - 1) : null, sentBy: status === 'sent' ? ctx.users.ciso.id : null, submissionProof: status === 'sent' ? `DEMO-${type}-proof` : null }, update: { status } });
  await byId(db.incidentReport, 'incident-report', { incidentId: incident.id, reportType: 'initial_notification', title: 'NIS2 initial notification demo', content: { summary: 'Ransomware-like activity contained.', impact: 'Customer portal outage.' }, status: 'submitted', dueAt: d(-10), submittedAt: d(-11), submittedBy: ctx.users.ciso.id, recipient: 'Demo regulator', submissionMethod: 'portal', submissionProof: 'DEMO-PROOF-001', createdBy: ctx.users.ciso.id }, { status: 'submitted' });
  await byId(db.incidentCommunication, 'incident-comm', { incidentId: incident.id, channel: 'email', direction: 'outbound', recipient: 'customers@example.invalid', sender: 'security@heliotech.example', message: 'Demo customer advisory for contained incident.', status: 'sent', sentAt: d(-11), createdBy: ctx.users.ciso.id }, { status: 'sent' });
  await byId(db.incidentEscalation, 'incident-escalation', { incidentId: incident.id, escalationType: 'management', level: 2, reason: 'Significant NIS2 demo incident.', dueAt: d(-11), escalatedTo: ctx.users.admin.id, status: 'resolved', resolvedAt: d(-10), createdBy: ctx.users.ciso.id }, { status: 'resolved' });
  const capa = tables.correctiveActions ? await byId(db.correctiveAction, 'capa-incident', { displayId: 'CAPA-DEMO-001', title: 'Remove legacy automation token exemption', description: 'Corrective action from incident workflow.', sourceType: 'incident', sourceId: incident.id, ownerId: ctx.users.asset.id, dueDate: d(45), priority: 'high', status: 'in_progress', rootCause: 'Legacy exception not reviewed.', containmentActions: ['Token revoked', 'Cluster isolated'], correctiveActions: ['Conditional access policy update', 'Quarterly exception review'], effectivenessCriteria: 'No unmanaged privileged token exemptions remain.', createdBy: ctx.users.ciso.id }, { status: 'in_progress' }) : null;
  if (tables.auditPrograms) {
    const program = await byId(db.auditProgram, 'audit-program', { displayId: 'AUD-PROG-DEMO-2026', title: 'ISMS Internal Audit Program 2026', year: 2026, scope: 'HelioTech Group ISMS scope', objectives: ['Validate ISO 27001 controls', 'Verify risk treatment progress'], criteria: ['ISO 27001:2022', 'NIS2 policy'], ownerId: ctx.users.auditor.id, status: 'approved', createdBy: ctx.users.auditor.id }, { status: 'approved' });
    const plan = await byId(db.auditPlan, 'audit-plan', { displayId: 'AUD-PLAN-DEMO-001', programId: program.id, auditType: 'internal', title: 'Cloud operations and incident readiness audit', scope: 'Identity, backup, logging and incident workflow', criteria: ['A.5.17', 'A.8.13', 'A.8.15'], auditorIds: [ctx.users.auditor.id], auditeeIds: [ctx.users.asset.id, ctx.users.ciso.id], plannedStart: d(30), plannedEnd: d(35), status: 'planned', approvedBy: ctx.users.ciso.id, approvedAt: d(-3), createdBy: ctx.users.auditor.id }, { status: 'planned' });
    await byId(db.auditFinding, 'audit-finding', { auditPlanId: plan.id, displayId: 'AF-DEMO-001', findingType: 'nonconformity', severity: 'medium', title: 'OT firewall exception recertification delayed', description: 'Sample showed one exception older than recertification window.', requirementIds: ['ISO27001-A.8.22'], controlIds: [riskDomain.controls[6].id], assetIds: [domain.assets[99].id], riskIds: [riskDomain.risks[3].id], correctiveActionId: capa?.id, ownerId: ctx.users.site.id, dueDate: d(70), status: 'open', createdBy: ctx.users.auditor.id }, { status: 'open' });
  }
  if (tables.trainingCourses) {
  const course = await byId(db.trainingCourse, 'training-awareness', { displayId: 'TRN-DEMO-001', title: 'Security Awareness and Incident Reporting 2026', description: 'Mandatory demo course.', category: 'security_awareness', mandatory: true, validityMonths: 12, acknowledgementRequired: true, ownerId: ctx.users.ciso.id, status: 'active', createdBy: ctx.users.ciso.id }, { title: 'Security Awareness and Incident Reporting 2026' });
  let ta = 1;
  for (const u of Object.values(ctx.users) as any[]) {
    const assignment = await byId(db.trainingAssignment, `training-assignment-${ta}`, { courseId: course.id, userId: u.id, assignedBy: ctx.users.ciso.id, assignedAt: d(-20), dueDate: d(25), status: ta % 4 === 0 ? 'overdue' : ta % 3 === 0 ? 'assigned' : 'completed', reminderLevel: ta % 4 === 0 ? 2 : 0, completedAt: ta % 3 === 0 ? null : d(-5), createdAt: d(-20) }, { status: ta % 4 === 0 ? 'overdue' : ta % 3 === 0 ? 'assigned' : 'completed' });
    if (ta % 3 !== 0) await byId(db.trainingCompletion, `training-completion-${ta}`, { assignmentId: assignment.id, courseId: course.id, userId: u.id, completedAt: d(-5), score: 82 + ta, result: 'passed', expiresAt: d(360), createdBy: u.id }, { score: 82 + ta });
    await db.trainingAcknowledgement.upsert({ where: { courseId_userId_version: { courseId: course.id, userId: u.id, version: '2026.1' } }, create: { courseId: course.id, userId: u.id, version: '2026.1', acknowledgedAt: d(-4), comment: 'Demo acknowledgement.' }, update: {} });
    ta += 1;
  }
  }
  const bia = tables.businessImpactAnalyses ? await byId(db.businessImpactAnalysis, 'bia-portal', { displayId: 'BIA-DEMO-001', title: 'Customer Portal BIA', processId: domain.processes[0].id, serviceId: domain.services[0].id, ownerId: ctx.users.bcm.id, mtpdMinutes: 480, rtoMinutes: 120, rpoMinutes: 30, impactCategories: ['financial', 'customer', 'regulatory'], timeDependentImpacts: { '2h': 'customer support load', '8h': 'contractual SLA risk' }, minimumOperatingLevel: 'Read-only customer status page and prioritized service desk.', requiredResources: { people: 6, systems: ['portal', 'identity', 'database', 'backup'] }, lastReviewDate: d(-40), nextReviewDate: d(180), status: 'approved', createdBy: ctx.users.bcm.id }, { status: 'approved' }) : null;
  if (bia && tables.biaAssetRelations) for (const a of [domain.assets[0], domain.assets[1], domain.assets[70]]) await db.bIAAssetRelation.upsert({ where: { biaId_assetId: { biaId: bia.id, assetId: a.id } }, create: { biaId: bia.id, assetId: a.id, role: 'critical_dependency' }, update: { role: 'critical_dependency' } });
  if (tables.businessContinuityPlans) {
    const bcp = await byId(db.businessContinuityPlan, 'bcp-portal', { displayId: 'BCP-DEMO-001', title: 'Customer Portal Recovery Plan', biaId: bia.id, ownerId: ctx.users.bcm.id, scope: 'Portal, identity and database recovery.', recoveryStrategies: ['restore from immutable backup', 'activate status page', 'manual priority support queue'], communicationPlan: { internal: 'Teams bridge', external: 'status page and account management' }, activationCriteria: 'Portal unavailable > 60 minutes or data integrity concern.', status: 'approved', approvedBy: ctx.users.ciso.id, approvedAt: d(-15), nextTestDate: d(90), createdBy: ctx.users.bcm.id }, { status: 'approved' });
    await byId(db.bCPExercise, 'bcp-exercise', { bcpId: bcp.id, exerciseType: 'tabletop', plannedAt: d(-10), executedAt: d(-10), participants: [ctx.users.bcm.id, ctx.users.ciso.id, ctx.users.asset.id], results: { rtoAchievedMinutes: 105, rpoAchievedMinutes: 20 }, findings: ['Improve customer communication template'], status: 'completed', createdBy: ctx.users.bcm.id }, { status: 'completed' });
  }
  const framework = await prisma.framework.upsert({ where: { code: 'DEMO-ISO27001' }, create: { id: id('framework'), name: 'Demo ISO/IEC 27001', code: 'DEMO-ISO27001', version: '2022', publisher: 'Demo', status: 'active' }, update: { version: '2022' } });
  const fwv = await prisma.frameworkVersion.upsert({ where: { frameworkId_version: { frameworkId: framework.id, version: '2022-demo' } }, create: { id: id('framework-version'), frameworkId: framework.id, version: '2022-demo', source: 'demo seed', createdBy: ctx.users.ciso.id }, update: {} });
  for (let i = 0; i < riskDomain.controls.length; i += 1) {
    const req = await prisma.requirement.upsert({ where: { frameworkVersionId_requirementKey: { frameworkVersionId: fwv.id, requirementKey: riskDomain.controls[i].catalogId } }, create: { id: id(`req-${i + 1}`), frameworkVersionId: fwv.id, requirementKey: riskDomain.controls[i].catalogId, title: riskDomain.controls[i].title, requirementText: riskDomain.controls[i].controlGoal, section: 'Demo Annex A' }, update: { title: riskDomain.controls[i].title } });
    await prisma.controlRequirementMapping.upsert({ where: { controlId_requirementId: { controlId: riskDomain.controls[i].id, requirementId: req.id } }, create: { controlId: riskDomain.controls[i].id, requirementId: req.id, mappingType: 'fully_fulfills', coverage: 'full', createdBy: ctx.users.ciso.id }, update: {} });
  }
  const soa = await byId(db.statementOfApplicability, 'soa-2026', { frameworkId: framework.id, frameworkVersion: '2022-demo', scopeId: ctx.scope.id, version: 1, controls: riskDomain.controls.map((c: any) => c.catalogId), approvalStatus: 'approved', submittedAt: d(-20), submittedBy: ctx.users.ciso.id, approvedAt: d(-10), approvedBy: ctx.users.admin.id, isImmutable: true, createdBy: ctx.users.ciso.id }, { approvalStatus: 'approved' });
  for (let i = 0; i < riskDomain.controls.length; i += 1) {
    const item = await byId(db.soAItem, `soa-item-${i + 1}`, { soaId: soa.id, controlId: riskDomain.controls[i].id, applicability: 'applicable', justification: 'Applicable to the approved HelioTech demo ISMS scope.', implementationStatus: i === 6 ? 'in_progress' : 'implemented', version: 1, isImmutable: true, createdBy: ctx.users.ciso.id }, { implementationStatus: i === 6 ? 'in_progress' : 'implemented' });
    await db.soAItemControlImplementation.upsert({ where: { soaItemId_controlImplementationId: { soaItemId: item.id, controlImplementationId: riskDomain.implementations[i].id } }, create: { soaItemId: item.id, controlImplementationId: riskDomain.implementations[i].id }, update: {} });
  }
  await byId(db.soAApproval, 'soa-approval', { soaId: soa.id, approverId: ctx.users.admin.id, decision: 'approved', comment: 'Approved for deterministic demo.', decidedAt: d(-10) }, { decision: 'approved' });
  if (tables.managementReviews) await byId(db.managementReview, 'mgmt-review', { displayId: 'MR-DEMO-001', title: 'ISMS Management Review Q1 2026', reviewDate: d(45), chairId: ctx.users.admin.id, participants: Object.values(ctx.users).slice(0, 5).map((u: any) => u.id), agenda: ['Risk posture', 'Incident lessons learned', 'Supplier reviews', 'BCM exercise'], inputs: { risks: riskDomain.risks.length, incidents: 1, audits: 1 }, decisions: ['Prioritize OT segmentation', 'Increase supplier assurance cadence'], minutes: 'Demo minutes prepared.', approvalStatus: 'draft', nextReviewDate: d(180), status: 'planned', createdBy: ctx.users.ciso.id }, { status: 'planned' });
  if (tables.securityObjectives) await byId(db.securityObjective, 'objective-patching', { displayId: 'OBJ-DEMO-001', title: 'Critical vulnerability remediation within 14 days', description: 'Improve technical vulnerability management.', ownerId: ctx.users.ciso.id, targetValue: 95, targetUnit: 'percent', periodStart: d(-15), periodEnd: d(350), status: 'active', createdBy: ctx.users.ciso.id }, { targetValue: 95 });
}

async function main() {
  console.log('\n🌱 Starting HelioTech demo seed...');
  const { methodVersion } = await requireBaseSeed();
  const ctx = await seedOrg();
  const domain = await seedAssets(ctx);
  const riskDomain = await seedControlsRisks(ctx, domain, methodVersion);
  await seedPhase6(ctx, domain, riskDomain);

  const counts: Record<string, number> = {
    legalEntities: await prisma.legalEntity.count({ where: { id: { startsWith: P } } }),
    sites: await prisma.site.count({ where: { id: { startsWith: P } } }),
    orgUnits: await prisma.organizationUnit.count({ where: { id: { startsWith: P } } }),
    users: await prisma.user.count({ where: { email: { endsWith: '@heliotech.example' } } }),
    userRoles: await prisma.userRole.count({ where: { id: { startsWith: P } } }),
    assets: await prisma.asset.count({ where: { displayId: { startsWith: 'AST-DEMO-' } } }),
    assetRelations: await prisma.assetRelation.count({ where: { id: { startsWith: P } } }),
    risks: await prisma.risk.count({ where: { displayId: { startsWith: 'RSK-DEMO-' } } }),
    controls: await prisma.control.count({ where: { id: { startsWith: P } } }),
    evidence: await prisma.evidence.count({ where: { id: { startsWith: P } } }),
    suppliers: await prisma.supplier.count({ where: { displayId: { startsWith: 'SUP-DEMO-' } } }),
    incidents: await prisma.incident.count({ where: { displayId: { startsWith: 'INC-DEMO-' } } }),
    auditFindings: await safeCount(db.auditFinding, { displayId: { startsWith: 'AF-DEMO-' } }),
    trainingAssignments: await safeCount(db.trainingAssignment, { id: { startsWith: P } }),
    bias: await safeCount(db.businessImpactAnalysis, { displayId: { startsWith: 'BIA-DEMO-' } }),
    soaItems: await db.soAItem.count({ where: { id: { startsWith: P } } }),
  };

  console.log('\n✅ Demo seed completed successfully.');
  console.log('\nEntity counts:', counts);
  console.log('\nLogin-test users (password for all: Demo123!@#):');
  for (const email of ['demo.admin@heliotech.example', 'demo.ciso@heliotech.example', 'demo.asset.owner@heliotech.example', 'demo.risk.owner@heliotech.example', 'demo.auditor@heliotech.example', 'demo.employee@heliotech.example']) console.log(`  - ${email}`);
  console.log('\nKey demo scenarios: HelioTech Group ISMS scope, 142 connected assets, scoped/future/expired roles, ransomware incident workflow, supplier assurance, risk treatment/acceptance, audit CAPA, BCM/BIA, training and SoA.');
  console.log('\nUnsupported/limited by current model: dedicated supplier finding/CAPA relations and training relations are stored via JSON/string IDs; Phase 6 modules use several FK-like String fields without Prisma relations; no schema changes were made.');
}

main().catch((error) => {
  console.error('\n❌ Demo seed failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
