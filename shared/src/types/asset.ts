// Asset types

import { BaseEntity } from './common';

export enum AssetType {
  PHYSICAL_SERVER = 'physical_server',
  CLIENT = 'client',
  VIRTUAL_MACHINE = 'virtual_machine',
  CONTAINER = 'container',
  NETWORK_COMPONENT = 'network_component',
  SECURITY_COMPONENT = 'security_component',
  MOBILE_DEVICE = 'mobile_device',
  OT_SYSTEM = 'ot_system',
  APPLICATION = 'application',
  SOFTWARE_PRODUCT = 'software_product',
  OPERATING_SYSTEM = 'operating_system',
  CLOUD_RESOURCE = 'cloud_resource',
  SAAS_SERVICE = 'saas_service',
  DATABASE = 'database',
  DATA_ASSET = 'data_asset',
  USER_ACCOUNT = 'user_account',
  TECHNICAL_ACCOUNT = 'technical_account',
  PRIVILEGED_IDENTITY = 'privileged_identity',
  CERTIFICATE = 'certificate',
  CRYPTOGRAPHIC_KEY = 'cryptographic_key',
  BUSINESS_PROCESS = 'business_process',
  IT_SERVICE = 'it_service',
  ENTERPRISE_SERVICE = 'enterprise_service',
  BUILDING = 'building',
  ROOM = 'room',
  SUPPLIER = 'supplier',
  EXTERNAL_SERVICE = 'external_service',
  CONTRACT = 'contract',
  LICENSE = 'license'
}

export enum AssetLifecycleStatus {
  PLANNED = 'planned',
  ORDERED = 'ordered',
  IN_STOCK = 'in_stock',
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  ISOLATED = 'isolated',
  DECOMMISSIONED = 'decommissioned',
  DISPOSED = 'disposed',
  DESTROYED = 'destroyed',
  LOST = 'lost',
  UNKNOWN = 'unknown'
}

export enum AssetRelationshipType {
  OPERATES_ON = 'operates_on',
  COMMUNICATES_WITH = 'communicates_with',
  USES = 'uses',
  CONTAINS = 'contains',
  PROTECTED_BY = 'protected_by',
  IS_PART_OF = 'is_part_of',
  PROCESSES_INFORMATION = 'processes_information',
  SUPPORTS_BUSINESS_PROCESS = 'supports_business_process',
  PROVIDED_BY_SUPPLIER = 'provided_by_supplier',
  DEPENDS_ON_SERVICE = 'depends_on_service',
  HAS_ADMIN_ACCESS_TO = 'has_admin_access_to',
  BACKED_UP_BY = 'backed_up_by'
}

export type RatingLevel = 'low' | 'medium' | 'high';

export interface Asset extends BaseEntity {
  name: string;
  description?: string;
  assetType: AssetType;
  subType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  externalId?: string;
  organizationUnitId?: string;
  locationId?: string;
  technicalOperatorId?: string;
  businessOwnerId?: string;
  informationSecurityResponsibleId?: string;
  businessProcessId?: string;
  serviceId?: string;

  // Contract/License info (AST-002)
  contractId?: string;
  licenseId?: string;
  licenseInfo?: string;
  contractEndsAt?: Date;
  licenseExpiresAt?: Date;

  // Extended rating dimensions (AST-004)
  personnelSafetyRelevance: RatingLevel;
  regulatoryRelevance: RatingLevel;
  financialDamagePotential: RatingLevel;
  productionDowntimeImpact: RatingLevel;

  lifecycleStatus: AssetLifecycleStatus;
  purchaseDate?: Date;
  commissioningDate?: Date;
  endOfSaleDate?: Date;
  endOfLifeDate?: Date;
  endOfSupportDate?: Date;
  confidentialityNeed: 'low' | 'medium' | 'high';
  integrityNeed: 'low' | 'medium' | 'high';
  availabilityNeed: 'low' | 'medium' | 'high';
  dataProtectionRelevance: boolean;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  networkAddresses?: string;
  dnsNames?: string;
  dataSource?: string;
  lastDetectedAt?: Date;

  // Relations
  documents?: AssetDocument[];
  vulnerabilities?: VulnerabilityAsset[];
  incidents?: IncidentAsset[];
  riskAssets?: RiskAsset[];
}

export interface AssetRelation {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: AssetRelationshipType;
  description?: string;
  createdAt: Date;
  createdBy: string;
}

// ==========================================
// ISO27001 - Contract Management (AST-002)
// ==========================================

export interface Contract extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  contractType: string; // purchase, maintenance, sla, support, etc.
  supplierId?: string; // FK to Asset (supplier type)
  startDate?: Date;
  endDate?: Date;
  renewalDate?: Date;
  value?: number;
  currency?: string;
  status: string;
  isArchived: boolean;
}

// ==========================================
// ISO27001 - License Management (AST-002)
// ==========================================

export interface License extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  licenseType: string; // perpetual, subscription, concurrent, etc.
  vendor?: string;
  productId?: string; // Reference to software asset
  licenseKey?: string;
  seats?: number;
  startDate?: Date;
  endDate?: Date;
  renewalDate?: Date;
  cost?: number;
  currency?: string;
  status: string;
  isArchived: boolean;
}

// ==========================================
// ISO27001 - Business Process (RSK-010)
// ==========================================

export interface BusinessProcess extends BaseEntity {
  displayId: string;
  name: string;
  description?: string;
  processOwner: string; // User ID
  category?: string; // core, supporting, management
  siacControlled: boolean;
  criticality: RatingLevel;
  status: string;
  isArchived: boolean;
}

// ==========================================
// Generic Document model
// ==========================================

export interface Document extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  documentType: string; // contract, license, certificate, manual, etc.
  url?: string;
  filePath?: string;
  fileHash?: string;
  mimeType?: string;
  fileSize?: number;
  version: string;
  status: string;
  isArchived: boolean;
}

// ==========================================
// Junction Tables
// ==========================================

export interface AssetDocument {
  id: string;
  assetId: string;
  documentId: string;
}

export interface RiskEvidence {
  id: string;
  riskId: string;
  evidenceId: string;
}

export interface RiskAsset {
  id: string;
  riskId: string;
  assetId: string;
}

export interface VulnerabilityAsset {
  id: string;
  vulnerabilityId: string;
  assetId: string;
}

export interface IncidentAsset {
  id: string;
  incidentId: string;
  assetId: string;
}

// ==========================================
// Asset Lifecycle Log (AST-030)
// ==========================================

export interface AssetLifecycleLog {
  id: string;
  assetId: string;
  previousStatus?: string;
  newStatus: string;
  changedAt: Date;
  changedByUserId?: string;
  reason?: string;
  disposalEvidence?: string; // AST-031: data destruction proof
}
