// Control and Compliance types

import { BaseEntity } from './common';
import type { RiskControl } from './risk';

export enum ControlStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  TESTED = 'tested',
  EFFECTIVE = 'effective',
  NOT_APPLICABLE = 'not_applicable'
}

export enum Applicability {
  APPLICABLE = 'applicable',
  NOT_APPLICABLE = 'not_applicable',
  UNDER_REVIEW = 'under_review'
}

export interface Framework extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  version: string;
  publisher?: string;
  publicationDate?: Date;
  licenseInfo?: string;
  versions?: FrameworkVersion[];
}

export interface FrameworkVersion extends BaseEntity {
  frameworkId: string;
  version: string;
  publicationDate?: Date;
  importedAt: Date;
  source?: string;
  licenseInfo: string;
  changelog?: string;
  isActive: boolean;
  isImmutable: boolean;
  requirements?: Requirement[];
}

export interface Requirement extends BaseEntity {
  frameworkVersionId: string;
  requirementKey: string;
  title: string;
  requirementText: string;
  section?: string;
  clauseNumber?: string;
  parentKey?: string;
  licenseNotice?: string;
}

export interface Control extends BaseEntity {
  id: string;
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  responsibleId?: string;
  applicability: Applicability;
  applicabilityJustification?: string;
  /** Abstract control default/status fields; concrete execution lives on ControlImplementation. */
  implementationStatus?: ControlStatus;
  maturityLevel?: number;
  implementationDescription?: string;
  affectedAssetIds: string[];
  affectedProcessIds: string[];
  affectedSiteIds: string[];
  testMethod?: string;
  testFrequency?: string;
  lastEffectivenessReview?: Date;
  nextTestDate?: Date;
  findings?: string;
  actions?: string;
  implementations?: ControlImplementation[];
  requirementMappings?: Array<{ requirement: Requirement }>;
}

export type ControlImplementationStatus = 'planned' | 'in_progress' | 'implemented' | 'tested' | 'effective' | 'not_applicable' | 'not_verified';

export interface ControlImplementation extends BaseEntity {
  controlId: string;
  scopeId?: string;
  organizationUnitId?: string;
  siteId?: string;
  implementationStatus: ControlImplementationStatus;
  maturityLevel: number;
  implementationDescription?: string;
  responsibleUserId: string;
  requirementIds: string[];
  testMethod?: string;
  testFrequency?: string;
  lastTestDate?: Date;
  nextTestDate?: Date;
  testResult?: string;
  findings?: ControlFinding[];
  actions?: ControlAction[];
  tests?: ControlTest[];
  riskControls?: RiskControl[];
}

export interface ControlTest extends BaseEntity {
  controlImplementationId: string;
  testType: string;
  testMethod?: string;
  testedBy: string;
  testedAt?: Date;
  result: string;
  effectivenessRating?: number;
  findings?: string;
  evidenceRequired?: boolean;
  nextTestDate?: Date;
}

export interface ControlFinding extends BaseEntity {
  implementationId: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'closed';
  dueDate?: Date;
}

export interface ControlAction extends BaseEntity {
  implementationId: string;
  findingId?: string;
  title: string;
  description?: string;
  responsibleUserId?: string;
  dueDate?: Date;
  status: 'open' | 'in_progress' | 'completed';
}

export interface StatementOfApplicability extends Omit<BaseEntity, 'version'> {
  frameworkId: string;
  frameworkVersion: string;
  scopeId: string;
  version: number;
  controls: SoAControlEntry[];
  approvalStatus: 'draft' | 'under_review' | 'approved' | 'superseded';
  submittedAt?: Date;
  submittedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  isImmutable: boolean;
  items?: SoAItem[];
}

export interface SoAItem extends Omit<BaseEntity, 'version'> {
  soaId: string;
  requirementId?: string;
  controlId?: string;
  applicability: Applicability;
  justification: string;
  implementationStatus: ControlStatus;
  controlImplementationIds: string[];
  riskIds: string[];
  evidenceIds: string[];
  version: number;
  isImmutable: boolean;
}

export interface SoAControlEntry {
  controlId: string;
  controlTitle: string;
  isApplicable: boolean;
  justification: string;
  implementationStatus: ControlStatus;
  implementedMeasures: string[];
  responsibleId?: string;
  relatedRiskIds: string[];
  evidenceIds: string[];
}

export interface FrameworkMapping extends BaseEntity {
  sourceFrameworkId: string;
  sourceRequirementId: string;
  targetFrameworkId: string;
  targetRequirementId: string;
  mappingType: 'fully_fulfills' | 'partially_fulfills' | 'supports';
  justification?: string;
}

export interface Evidence extends BaseEntity {
  title: string;
  description?: string;
  evidenceType: string;
  fileHash: string;
  hashAlgorithm: string;
  classification: string;
  retentionPeriod?: string;
  retentionUntil?: Date;
  expiresAt?: Date;
  deleteProtected: boolean;
  relatedControlIds: string[];
  relatedRiskIds: string[];
  relatedAssetIds: string[];
  relatedSoAItemIds: string[];
  relatedDocumentIds: string[];
}

export interface PolicyDocument extends BaseEntity {
  title: string;
  documentType: string;
  workflowStatus: 'draft' | 'review' | 'approved' | 'published' | 'withdrawn';
  version: string;
  ownerId: string;
  reviewerId?: string;
  approverId?: string;
  nextReviewDate?: Date;
  isImmutable: boolean;
}
