/** Routes that replace the legacy generic Create/Edit forms. */
export const guidedRouteForPhase6Resource: Record<string, string> = {
  auditPlans: '/isms-operations/audits',
  correctiveActions: '/isms-operations/audits',
  trainingAssignments: '/isms-operations/workspace',
  managementReviews: '/isms-operations/workspace',
  metricDefinitions: '/isms-operations/workspace',
  workflowInstances: '/isms-operations/workspace',
  reportRuns: '/isms-operations/workspace',
};

export function getGuidedRouteForPhase6Resource(resource: string): string | undefined {
  return guidedRouteForPhase6Resource[resource];
}

export function isPhase6LegacyReadOnlyResource(resource: string): boolean {
  return resource === 'suppliers' || resource === 'bias' || resource === 'bcps';
}
