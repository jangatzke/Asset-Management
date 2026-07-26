import { PrismaClient } from '@prisma/client';

export const ISO27001_STANDARD_ASSET_TYPES = [
  { name: 'information', category: 'information', description: 'Information assets and records' },
  { name: 'software', category: 'software', description: 'Software assets and applications' },
  { name: 'physical', category: 'physical', description: 'Physical assets and equipment' },
  { name: 'services', category: 'service', description: 'Internal and external services' },
  { name: 'people', category: 'people', description: 'People, roles and competencies' },
  { name: 'intangible', category: 'intangible', description: 'Intangible assets such as reputation and knowledge' },
  { name: 'physical_server', category: 'hardware', description: 'Physical server systems' },
  { name: 'client', category: 'hardware', description: 'Client endpoints and workstations' },
  { name: 'virtual_machine', category: 'hardware', description: 'Virtual machine instances' },
  { name: 'container', category: 'hardware', description: 'Containerized runtime assets' },
  { name: 'network_component', category: 'hardware', description: 'Network devices and components' },
  { name: 'security_component', category: 'hardware', description: 'Security appliances and components' },
  { name: 'mobile_device', category: 'hardware', description: 'Mobile devices' },
  { name: 'application', category: 'software', description: 'Business applications' },
  { name: 'software_product', category: 'software', description: 'Software products' },
  { name: 'operating_system', category: 'software', description: 'Operating systems' },
  { name: 'database', category: 'software', description: 'Databases' },
  { name: 'data_asset', category: 'data', description: 'Data sets and repositories' },
  { name: 'cloud_resource', category: 'cloud', description: 'Cloud infrastructure resources' },
  { name: 'saas_service', category: 'cloud', description: 'SaaS services' },
  { name: 'it_service', category: 'service', description: 'IT services' },
  { name: 'enterprise_service', category: 'service', description: 'Enterprise services' },
  { name: 'user_account', category: 'identity', description: 'User accounts' },
  { name: 'technical_account', category: 'identity', description: 'Technical/service accounts' },
  { name: 'privileged_identity', category: 'identity', description: 'Privileged identities' },
  { name: 'certificate', category: 'security', description: 'Certificates' },
  { name: 'cryptographic_key', category: 'security', description: 'Cryptographic keys' },
  { name: 'business_process', category: 'business', description: 'Business processes' },
  { name: 'supplier', category: 'external', description: 'Suppliers' },
  { name: 'external_service', category: 'external', description: 'External services' },
  { name: 'contract', category: 'legal', description: 'Contracts' },
  { name: 'license', category: 'legal', description: 'Licenses' },
  { name: 'building', category: 'facility', description: 'Buildings' },
  { name: 'room', category: 'facility', description: 'Rooms' },
  { name: 'ot_system', category: 'ot', description: 'Operational technology systems' },
];

export async function ensureStandardAssetTypes(db: PrismaClient): Promise<void> {
  for (const assetType of ISO27001_STANDARD_ASSET_TYPES) {
    await db.assetType.upsert({
      where: { name: assetType.name },
      create: assetType,
      update: { category: assetType.category, description: assetType.description, isArchived: false },
    });
  }
}
