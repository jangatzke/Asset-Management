// Risk types

import { BaseEntity } from './common';
import { RatingLevel, RiskEvidence, RiskAsset } from './asset';

export enum RiskStatus {
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  TREATMENT_PLANNED = 'treatment_planned',
  TREATMENT_IN_PROGRESS = 'treatment_in_progress',
  ACCEPTED = 'accepted',
  CLOSED = 'closed'
}

export enum RiskTreatmentOption {
  AVOID = 'avoid',
  REDUCE = 'reduce',
  TRANSFER = 'transfer',
  ACCEPT = 'accept'
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// ==========================================
// Risk Method (RSK-001/RSK-002) - Versioned risk methodology
// ==========================================

export interface RiskMethod extends BaseEntity {
  displayId: string;
  name: string;
  description?: string;
  version: string;
  likelihoodScale: Record<string, unknown>; // configurable scale definition
  impactScale: Record<string, unknown>; // configurable scale definition
  ratingDimensions: Record<string, unknown>; // configurable dimensions
  formula: string; // calculation formula
  riskClasses: Record<string, unknown>; // risk class definitions
  acceptanceThresholds?: Record<string, unknown>; // acceptable risk thresholds
  escalationThresholds?: Record<string, unknown>; // escalation triggers (RSK-022)
  approvalRules?: Record<string, unknown>; // RSK-021: approval rules for acceptance
  reviewInterval?: number; // days between reviews
  isActive: boolean;
  isArchived: boolean;
}

export interface Risk extends BaseEntity {
  displayId: string;
  title: string;
  description: string;
  organizationUnitId?: string;
  affectedAssetIds: string[];
  affectedProcessIds: string[];
  affectedServiceIds: string[];
  threatId?: string;
  vulnerabilityId?: string;
  possibleImpact: string;
  existingControls: string[];
  likelihood: number;
  impact: number;
  inherentRisk: RiskLevel;
  residualRisk: RiskLevel;
  targetRisk: RiskLevel;
  riskOwnerId: string;
  assessorId: string;
  assessmentDate: Date;
  nextReviewDate: Date;
  evaluationJustification?: string;
  businessProcessId?: string;
  status: RiskStatus;

  // Relations
  evidenceLinks?: RiskEvidence[];
  riskAssets?: RiskAsset[];
  treatments?: RiskTreatment[];
}

// ==========================================
// Risk Treatment (RSK-020)
// ==========================================

export interface RiskTreatment extends BaseEntity {
  displayId: string;
  riskId: string;
  treatmentOption: RiskTreatmentOption; // avoid, reduce, transfer, accept
  plannedActions?: string;
  responsibleUserId?: string;
  budget?: number;
  targetDate?: Date;
  expectedReduction?: string;
  dependencies?: string;
  implementationStatus: string; // planned, in_progress, completed
  effectivenessReview?: string;
  completionApproval?: string;
  justification?: string; // required for acceptance
  expiryDate?: Date; // RSK-023: acceptance cannot be unlimited
  approvedByUserId?: string;
  isArchived: boolean;
}

export interface Threat extends BaseEntity {
  name: string;
  description: string;
  category: string;
  source?: string;
}

export interface Vulnerability extends BaseEntity {
  name: string;
  description: string;
  category: string;
  severity: RatingLevel | 'critical';
  cveId?: string;
  cvssScore?: number;
}
