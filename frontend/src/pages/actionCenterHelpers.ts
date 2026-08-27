/**
 * Shared, non-component constants for the Action Center page.
 *
 * Extracted into their own module so that `ActionCenter.tsx` only exports
 * components, which keeps React Fast Refresh working for the page component.
 */
import type { ActionCenterParams } from '../services/api';

export const ACTION_CENTER_SOURCE_OPTIONS: ReadonlyArray<{ value: NonNullable<ActionCenterParams['sourceType']>; label: string }> = [
  { value: 'incidentNonReportableApproval', label: 'Incident non-reportable approval' },
  { value: 'workflowTask', label: 'Workflow task' },
  { value: 'notificationDeadline', label: 'Notification deadline' },
  { value: 'correctiveAction', label: 'Corrective action' },
  { value: 'riskReviewTask', label: 'Risk review' },
  { value: 'trainingAssignment', label: 'Training assignment' },
  { value: 'auditFinding', label: 'Audit finding' },
  { value: 'managementReviewAction', label: 'Management review action' },
  { value: 'documentReview', label: 'Document review' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'supplierAssessment', label: 'Assessment' },
  { value: 'businessImpactAnalysis', label: 'BIA' },
  { value: 'businessContinuityPlan', label: 'BCP' },
  { value: 'bcpExercise', label: 'BCP Exercise' },
  { value: 'auditPlan', label: 'Audit Plan' },
  { value: 'managementReview', label: 'Management Review' },
];
