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
}

export interface Requirement extends BaseEntity {
  frameworkId: string;
  controlId: string;
  requirementText: string;
  section?: string;
  clauseNumber?: string;
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
  organizationUnitId?: string;
  status: ControlStatus;
  maturityLevel: number;
  implementationDescription?: string;
  responsibleId: string;
  lastTestDate?: Date;
  nextTestDate?: Date;
  testResult?: string;
}

export interface StatementOfApplicability extends BaseEntity {
  frameworkId: string;
  frameworkVersion: string;
  scopeId: string;
  version: number;
  controls: SoAControlEntry[];
  approvalStatus: 'draft' | 'under_review' | 'approved' | 'superseded';
  approvedAt?: Date;
  approvedBy?: string;
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
