/// <reference types="vitest" />
import { ACTION_CENTER_SOURCE_OPTIONS } from './actionCenterHelpers';

test('Action Center exposes every Phase-6 source type supported by the API with its explicit label', () => {
  expect(ACTION_CENTER_SOURCE_OPTIONS).toEqual(expect.arrayContaining([
    { value: 'supplier', label: 'Supplier' },
    { value: 'supplierAssessment', label: 'Assessment' },
    { value: 'businessImpactAnalysis', label: 'BIA' },
    { value: 'businessContinuityPlan', label: 'BCP' },
    { value: 'bcpExercise', label: 'BCP Exercise' },
    { value: 'auditPlan', label: 'Audit Plan' },
    { value: 'managementReview', label: 'Management Review' },
  ]));
});
