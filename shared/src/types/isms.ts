export type Phase6Resource =
  | 'suppliers'
  | 'supplierAssessments'
  | 'bias'
  | 'bcps'
  | 'bcpExercises'
  | 'auditPrograms'
  | 'auditPlans'
  | 'auditFindings'
  | 'correctiveActions'
  | 'trainingCourses'
  | 'trainingAssignments'
  | 'managementReviews'
  | 'securityObjectives'
  | 'metricDefinitions'
  | 'metricValues'
  | 'workflowDefinitions'
  | 'workflowInstances'
  | 'workflowTasks'
  | 'reportDefinitions'
  | 'reportRuns'
  | 'exportJobs';

export interface SupplierDTO {
  id: string;
  displayId: string;
  legalName: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataProtectionRelevant: boolean;
  nis2Relevant: boolean;
  nextReviewDate?: string;
  status: string;
}

export interface CorrectiveActionDTO {
  id: string;
  displayId: string;
  title: string;
  sourceType: 'audit' | 'incident' | 'risk' | 'control' | 'supplier';
  sourceId?: string;
  ownerId: string;
  dueDate: string;
  status: string;
  effectivenessStatus?: string;
}

export interface WorkflowTransitionDTO {
  transition: string;
  comment?: string;
  assigneeId?: string;
}

export interface ExportJobDTO {
  id: string;
  entityType: string;
  format: 'json' | 'csv';
  status: string;
  payload?: string;
  rowCount: number;
}
