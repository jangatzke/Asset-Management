import { BaseEntity } from './common';

export type Nis2ApplicabilityResult = 'essential_entity' | 'important_entity' | 'not_in_scope';

export interface Nis2QuestionnaireVersion extends BaseEntity {
  version: string;
  title: string;
  questions: Array<Record<string, unknown>>;
  scoringRules: Record<string, unknown>;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status: 'active' | 'retired';
}

export interface Nis2Assessment extends BaseEntity {
  organizationUnitId?: string;
  assessmentType: 'applicability';
  questionnaireVersion: string;
  answers: Record<string, unknown>;
  preliminaryResult?: Nis2ApplicabilityResult;
  preliminaryJustification?: string;
  result?: Nis2ApplicabilityResult;
  justification?: string;
  submittedForApprovalAt?: Date;
  submittedForApprovalBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  version: string;
  status: 'draft' | 'under_review' | 'approved' | 'active';
}

export interface Nis2Registration extends BaseEntity {
  assessmentId?: string;
  entityType: string;
  registrationDate?: Date;
  deadline?: Date;
  contactPerson?: string;
  contactDetails?: string;
  submittedData?: Record<string, unknown>;
  submissionProof?: string;
  bsiConfirmation?: string;
  changeNotifications?: Record<string, unknown>;
  lastReviewDate?: Date;
  status: 'pending' | 'submitted' | 'confirmed';
}

export interface Nis2RegistrationChange extends BaseEntity {
  registrationId: string;
  changeType: string;
  description: string;
  changedData: Record<string, unknown>;
  notificationDeadline?: Date;
  submittedAt?: Date;
  submissionProof?: string;
  status: 'draft' | 'submitted';
}

export interface Nis2Topic {
  key: string;
  title: string;
}
