import { humanizeWorkflowAction, pickerEntityTypeForWorkflow, workflowEntityTypes } from './workflowUx';

describe('workflow UX helpers', () => {
  it('uses the workflow definition entity type for the entity picker', () => {
    expect(workflowEntityTypes({ entityType: 'risk' })).toEqual([{ value: 'risk', label: 'Risk' }]);
    expect(pickerEntityTypeForWorkflow('unsupported-engine-entity')).toBeNull();
  });

  it('prefers a workflow action label and humanizes unlabeled internal keys', () => {
    expect(humanizeWorkflowAction({ key: 'approve_request', label: 'Approve' })).toBe('Approve');
    expect(humanizeWorkflowAction({ key: 'request_changes', label: '' })).toBe('Request Changes');
  });
});
