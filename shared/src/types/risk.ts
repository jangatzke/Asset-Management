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
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

export type RiskApprovalLevel = 'risk_owner' | 'management';
export type RiskApprovalDecision = 'approved' | 'rejected';
export type RiskAcceptanceStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';

export type CalculationType = 'product' | 'sum' | 'max' | 'matrix';

/** Assessment type distinguishes inherent, current (existing/residual), and target. */
export type AssessmentType = 'inherent' | 'current' | 'target';
export type RiskControlRole = 'preventive' | 'detective' | 'corrective' | 'recovery' | 'compensating';
export type RiskControlMitigationDimension = 'likelihood' | 'impact' | 'both';

/** Review task trigger types */
export type ReviewTaskTriggerType = 'scheduled' | 'unplanned_event' | 'ad_hoc';

/** Review task status */
export type ReviewTaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

/** Review task priority */
export type ReviewTaskPriority = 'low' | 'medium' | 'high' | 'critical';

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
  calculationType: CalculationType; // product, sum, max, matrix
  formulaExpression?: string; // deprecated — use calculationType
  riskClasses: Record<string, unknown>; // risk class definitions
  acceptanceThresholds?: Record<string, unknown>; // acceptable risk thresholds
  escalationThresholds?: Record<string, unknown>; // escalation triggers (RSK-022)
  approvalRules?: Record<string, unknown>; // RSK-021: approval rules for acceptance
  reviewInterval?: number; // days between reviews
  isActive: boolean;
  isArchived: boolean;
}

/**
 * Immutable snapshot of a RiskMethod at a point in time.
 * Once referenced by an assessment, this version cannot be modified.
 */
export interface RiskMethodVersion extends BaseEntity {
  riskMethodId: string;
  versionTag: string; // e.g. "2.0.0-snapshot-1"
  likelihoodScale: Record<string, unknown>;
  impactScale: Record<string, unknown>;
  ratingDimensions: Record<string, unknown>;
  calculationType: CalculationType;
  formulaExpression?: string;
  riskClasses: Record<string, unknown>;
  isImmutable: boolean; // true once first assessment references this version
}

/**
 * A specific assessment snapshot bound to a method version.
 * Multiple assessments can exist per risk, forming an immutable history.
 * assessmentType distinguishes inherent, current and target risk views.
 * justification is mandatory for every assessment.
 */
export interface RiskAssessment extends BaseEntity {
  riskId: string;
  riskMethodVersionId: string;
  assessmentNumber: number; // ordinal version for this risk
  assessmentType: AssessmentType; // inherent, current, target
  likelihood: number;
  impact: number;
  inherentRisk: RiskLevel | string;
  residualRisk: RiskLevel | string;
  targetRisk: RiskLevel | string;
  score?: number;
  assessorId: string;
  assessedAt: Date;
  nextReviewDate: Date;
  justification: string; // Mandatory — every assessment requires a justification
  isCurrent: boolean; // only one assessment per risk can be current
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
  /** Deprecated direct risk-control field; use riskControls links instead. */
  existingControls?: never;
  likelihood: number;
  impact: number;
  inherentRisk: RiskLevel | string;
  residualRisk: RiskLevel | string;
  targetRisk: RiskLevel | string;
  riskOwnerId: string;
  assessorId: string;
  assessmentDate: Date;
  nextReviewDate: Date;
  evaluationJustification?: string;
  businessProcessId?: string;
  status: RiskStatus;
  version: string;
  riskMethodVersionId?: string; // FK to RiskMethodVersion
  scenarioId?: string; // Relational reference to RiskScenario

  // Relations
  evidenceLinks?: RiskEvidence[];
  riskAssets?: RiskAsset[];
  treatments?: RiskTreatment[];
  assessments?: RiskAssessment[];
  causes?: RiskCause[];
  impacts?: RiskImpact[];
  reviewTasks?: ReviewTask[];
  riskControls?: RiskControl[];
}

export interface RiskControl extends BaseEntity {
  riskId: string;
  controlImplementationId: string;
  role: RiskControlRole;
  mitigationDimension: RiskControlMitigationDimension;
  isKeyControl: boolean;
  status: string;
  assessments?: RiskControlAssessment[];
}

export interface RiskControlAssessment extends BaseEntity {
  riskControlId: string;
  riskAssessmentVersionId: string;
  effectivenessStatus: 'not_verified' | 'ineffective' | 'partially_effective' | 'effective';
  effectivenessRating?: number;
  likelihoodReduction?: number;
  impactReduction?: number;
  justification: string;
  assessedBy: string;
}

// ==========================================
// Risk Treatment (RSK-020)
// ==========================================

export interface RiskTreatment extends BaseEntity {
  displayId: string;
  riskId: string;
  assessmentId?: string;
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
  completedAt?: Date;
  completedBy?: string;
  residualAssessmentId?: string;
  actions?: TreatmentAction[];
  acceptance?: RiskAcceptance;
  approvals?: RiskTreatmentApproval[];
  effectivenessReviews?: RiskTreatmentEffectivenessReview[];
  isArchived: boolean;
}

export interface TreatmentAction extends BaseEntity {
  treatmentId: string;
  actionType: 'create' | 'extend' | 'replace' | 'improve';
  title: string;
  description?: string;
  controlImplementationId?: string;
  responsibleUserId?: string;
  targetDate?: Date;
  status: string;
}

export interface RiskAcceptance extends BaseEntity {
  treatmentId: string;
  riskId: string;
  assessmentId: string;
  justification: string;
  expiryDate: Date;
  requestedBy: string;
  requiredLevel: RiskApprovalLevel;
  status: RiskAcceptanceStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export interface RiskTreatmentApproval {
  id: string;
  treatmentId: string;
  approverId: string;
  approvalLevel: RiskApprovalLevel;
  decision: RiskApprovalDecision;
  comment?: string;
  decidedAt: Date;
}

export interface RiskTreatmentEffectivenessReview {
  id: string;
  treatmentId: string;
  result: string;
  reviewDate: Date;
  reviewerId: string;
  notes?: string;
  createdAt: Date;
}

// ==========================================
// Risk Building Blocks (Paket 3.2)
// ==========================================

export interface Threat extends BaseEntity {
  displayId: string;
  name: string;
  description: string;
  category: string;
  source?: string;
  status: string;
  isArchived: boolean;
}

export interface Vulnerability extends BaseEntity {
  displayId: string;
  name: string;
  description: string;
  category: string;
  severity: RatingLevel | 'critical';
  cveId?: string;
  cvssScore?: number;
  status: string;
  isArchived: boolean;
}

/** RiskScenario combines a Threat with an optional Vulnerability to describe a concrete risk scenario. */
export interface RiskScenario extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  threatId: string;
  vulnerabilityId?: string;
}

/** Root cause contributing to the risk. */
export interface RiskCause extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  category?: string; // technical, organizational, human, environmental
}

/** Concrete business/technical impact of the risk. */
export interface RiskImpact extends BaseEntity {
  displayId: string;
  title: string;
  description?: string;
  category?: string; // confidentiality, integrity, availability, financial, reputational, legal, safety
  severity?: string; // low, medium, high, very_high
}

/** ReviewTask represents a scheduled or ad-hoc risk review task. */
export interface ReviewTask extends BaseEntity {
  displayId: string;
  riskId: string;
  scheduledDate: Date;
  dueDate: Date;
  status: ReviewTaskStatus;
  priority: ReviewTaskPriority;
  assignedTo?: string; // user ID of reviewer/owner
  triggerType: ReviewTaskTriggerType;
  triggerEventId?: string; // reference to the triggering event
  triggerSource?: string; // human-readable source description
  notes?: string;
  completedAt?: Date;
  completedBy?: string;
  isArchived: boolean;
}

// ==========================================
// Paket 3.4 — Risk Aggregations
// ==========================================

export type RiskAggregationGroupBy = 'orgUnit' | 'location' | 'assetType' | 'process' | 'service' | 'scope' | 'riskClass' | 'status' | 'assessmentType';

export interface RiskAggregationFilters {
  from?: Date;
  to?: Date;
  scope?: string[];
  organizationUnitId?: string;
  status?: RiskStatus | string;
  riskClass?: RiskLevel | string;
  assessmentType?: AssessmentType;
  methodVersionId?: string;
  isCurrent?: boolean;
}

export interface RiskAggregationResultGroup {
  key: string;
  label: string;
  totalRisks: number;
  riskCountBySeverity: Record<string, number>;
  totalInherentRiskScore: number;
  totalResidualRiskScore: number;
  topRisks: Array<{ id: string; title: string; inherentRisk: string; residualRisk: string }>;
}

export interface RiskDashboardSummary {
  totalRisks: number;
  byStatus: Record<string, number>;
  byProbability: Record<string, number>;
  bySeverity: Record<string, number>;
  highRiskAssets: Array<{ assetId: string; assetName: string; riskCount: number }>;
}
