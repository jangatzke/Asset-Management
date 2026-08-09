import { getGuidedRouteForPhase6Resource, isPhase6LegacyReadOnlyResource } from './ismsPhase6Routing';

test.each([
    'auditPlans',
    'correctiveActions',
    'trainingAssignments',
    'metricDefinitions',
    'managementReviews',
    'workflowInstances',
    'reportRuns',
])('routes %s to a guided workflow', (resource) => {
  expect(getGuidedRouteForPhase6Resource(resource)).toBeTruthy();
});

test('keeps supplier and BCM legacy listings read-only', () => {
  expect(isPhase6LegacyReadOnlyResource('suppliers')).toBe(true);
  expect(isPhase6LegacyReadOnlyResource('bias')).toBe(true);
  expect(isPhase6LegacyReadOnlyResource('bcps')).toBe(true);
});
