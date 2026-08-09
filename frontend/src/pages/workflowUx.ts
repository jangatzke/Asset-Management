import type { EntityType } from '../services/entityPickerApi';

export interface WorkflowDefinitionSummary {
  entityType?: string | null;
}

export interface WorkflowAction {
  key: string;
  label: string;
}

const entityTypeLabels: Record<EntityType, string> = {
  user: 'User',
  asset: 'Asset',
  organizationUnit: 'Organization unit',
  supplier: 'Supplier',
  risk: 'Risk',
  contract: 'Contract',
  control: 'Control',
  businessProcess: 'Business process',
  bcp: 'Business continuity plan',
  bia: 'Business impact analysis',
  requirement: 'Requirement',
  evidence: 'Evidence',
};

export function pickerEntityTypeForWorkflow(entityType?: string | null): EntityType | null {
  if (!entityType || !(entityType in entityTypeLabels)) return null;
  return entityType as EntityType;
}

export function workflowEntityTypes(definition: WorkflowDefinitionSummary | null): Array<{ value: EntityType; label: string }> {
  const entityType = pickerEntityTypeForWorkflow(definition?.entityType);
  return entityType ? [{ value: entityType, label: entityTypeLabels[entityType] }] : [];
}

export function humanizeWorkflowAction(action: Pick<WorkflowAction, 'key' | 'label'>): string {
  if (action.label?.trim()) return action.label.trim();
  return action.key.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}
