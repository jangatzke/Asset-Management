// Incident types

import { BaseEntity } from './common';

export enum IncidentStatus {
  NEW = 'new',
  UNDER_INVESTIGATION = 'under_investigation',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationStatus {
  NOT_REQUIRED = 'not_required',
  PENDING_ASSESSMENT = 'pending_assessment',
  EARLY_WARNING_SENT = 'early_warning_sent',
  DETAILED_REPORT_SENT = 'detailed_report_sent',
  FINAL_REPORT_SENT = 'final_report_sent'
}

export type IncidentReportType = 'early_warning_24h' | 'incident_notification_72h' | 'interim_report' | 'monthly_final_report';

export interface Incident extends BaseEntity {
  title: string;
  description: string;
  detectionTime: Date;
  knowledgeTime: Date;
  reporterId?: string;
  reporterSource?: string;
  affectedAssetIds: string[];
  affectedServiceIds: string[];
  affectedProcessIds: string[];
  confidentialityImpact: 'none' | 'low' | 'medium' | 'high';
  integrityImpact: 'none' | 'low' | 'medium' | 'high';
  availabilityImpact: 'none' | 'low' | 'medium' | 'high';
  operationalImpact?: string;
  financialImpact?: number;
  legalImpact?: string;
  personalDataImpact?: boolean;
  affectedCustomers?: string[];
  affectedThirdParties?: string[];
  suspectedCause?: string;
  isIntentional?: boolean;
  hasCrossBorderImpact?: boolean;
  indicatorsOfCompromise?: string[];
  immediateActions?: string[];
  incidentManagerId: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  notificationStatus: NotificationStatus;
  significanceRuleVersionId?: string;
  isSignificant?: boolean;
  significanceReasons?: string[];
  rootCause?: string;
  lessonsLearned?: string;
  measuresEvaluation?: string;
  closureSummary?: string;
  closedAt?: Date;
  closedBy?: string;
}

export interface IncidentAssessment extends BaseEntity {
  incidentId: string;
  assessorId: string;
  isReportable: boolean;
  reportingJustification?: string;
  decisionNotToReport?: string;
  decisionApprovedBy?: string;
  decisionApprovedAt?: Date;
  significanceRuleVersionId?: string;
  evaluatedRules?: Record<string, unknown>;
  assessmentDate: Date;
}

export interface NotificationDeadline extends BaseEntity {
  incidentId: string;
  notificationType: IncidentReportType;
  deadlineDate: Date;
  knowledgeTimeReference: Date;
  status: 'pending' | 'sent' | 'overdue';
  sentAt?: Date;
  sentBy?: string;
  submissionProof?: string;
}

export interface IncidentReport extends Omit<BaseEntity, 'createdBy'> {
  incidentId: string;
  reportType: IncidentReportType;
  title: string;
  content: Record<string, unknown>;
  status: 'draft' | 'submitted';
  dueAt?: Date;
  createdBy?: string;
  submittedAt?: Date;
  submittedBy?: string;
  recipient?: string;
  submissionMethod?: 'manual' | 'api' | 'portal';
  submissionProof?: string;
  exportPayload?: Record<string, unknown>;
}

export interface IncidentCommunication extends BaseEntity {
  incidentId: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  recipient: string;
  sender?: string;
  message: string;
  status: 'planned' | 'sent';
  scheduledAt?: Date;
  sentAt?: Date;
  responseReceivedAt?: Date;
}

export interface IncidentEscalation extends BaseEntity {
  incidentId: string;
  escalationType: string;
  level: number;
  reason: string;
  dueAt?: Date;
  escalatedTo?: string;
  status: 'open' | 'resolved';
  resolvedAt?: Date;
}

export interface IncidentKnowledgeTimeChange extends BaseEntity {
  incidentId: string;
  oldKnowledgeTime: Date;
  newKnowledgeTime: Date;
  reason: string;
  changedBy: string;
  changedAt: Date;
}
