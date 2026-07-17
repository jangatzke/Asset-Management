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
}

export interface IncidentAssessment extends BaseEntity {
  incidentId: string;
  assessorId: string;
  isReportable: boolean;
  reportingJustification?: string;
  decisionNotToReport?: string;
  decisionApprovedBy?: string;
  assessmentDate: Date;
}

export interface NotificationDeadline extends BaseEntity {
  incidentId: string;
  notificationType: 'early_warning' | 'detailed_report' | 'interim_report' | 'final_report';
  deadlineDate: Date;
  knowledgeTimeReference: Date;
  status: 'pending' | 'sent' | 'overdue';
  sentAt?: Date;
  sentBy?: string;
  submissionProof?: string;
}

export interface IncidentReport extends BaseEntity {
  incidentId: string;
  reportType: 'early_warning' | 'detailed_report' | 'interim_report' | 'final_report';
  content: string;
  authorId: string;
  submittedAt?: Date;
  recipient?: string;
  submissionMethod: 'manual' | 'api' | 'portal';
}
