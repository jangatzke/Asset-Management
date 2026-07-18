// Control and Compliance types

import { BaseEntity } from './common';

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
  implementationStatus: ControlStatus;
  maturityLevel: number;
  implementationDescription?: string;
  affectedAssetIds: string[];
  affectedProcessIds: string[];
  affectedSiteIds: string[];
  relatedRiskIds: string[];
  evidenceIds: string[];
  testMethod?: string;
  testFrequency?: string;
  lastEffectivenessReview?: Date;
  nextTestDate?: Date;
  findings?: string;
  actions?: string;
}

export interface ControlImplementation extends BaseEntity {
  controlId: string;
  scopeId?: string;
  organizationUnitId?: string;
  siteId?: string;
  status: ControlStatus;
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

export interface StatementOfApplicability extends BaseEntity {
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

export interface SoAItem extends BaseEntity {
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
