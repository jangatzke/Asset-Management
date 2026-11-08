import type { EntityType, EntityPickerResult } from '../services/entityPickerApi';

/**
 * Fields in the Phase 6 create/edit form that hold references to other
 * entities. They are presented with `EntityPicker` and must keep explicit
 * `null` values so clearing a nullable reference removes the relation.
 */
export const ENTITY_REFERENCE_FIELDS = new Set<string>([
  'ownerId',
  'chairId',
  'userId',
  'auditorIds',
  'courseId',
  'definitionId',
  'entityId',
  'sourceId',
  'businessProcesses',
  'resources',
  'dependencies',
]);

export interface EntityPickerConfig {
  entityType: EntityType;
  labelKey: string;
  multi?: boolean;
}

const STATIC_PICKER_CONFIG: Record<string, EntityPickerConfig> = {
  ownerId: { entityType: 'user', labelKey: 'ismsPhase6.fields.owner' },
  chairId: { entityType: 'user', labelKey: 'ismsPhase6.fields.chair' },
  userId: { entityType: 'user', labelKey: 'ismsPhase6.fields.assignee' },
  auditorIds: { entityType: 'user', labelKey: 'ismsPhase6.fields.auditors', multi: true },
  courseId: { entityType: 'trainingCourse', labelKey: 'ismsPhase6.fields.course' },
  definitionId: { entityType: 'workflowDefinition', labelKey: 'ismsPhase6.fields.workflow_definition' },
  businessProcesses: { entityType: 'businessProcess', labelKey: 'ismsPhase6.fields.business_processes', multi: true },
  resources: { entityType: 'asset', labelKey: 'ismsPhase6.fields.resources', multi: true },
  dependencies: { entityType: 'supplier', labelKey: 'ismsPhase6.fields.dependencies', multi: true },
};

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  asset: 'asset',
  risk: 'risk',
  control: 'control',
  supplier: 'supplier',
  contract: 'contract',
  incident: 'incident',
  audit: 'auditPlan',
  auditplan: 'auditPlan',
  audit_plan: 'auditPlan',
  managementreview: 'managementReview',
  management_review: 'managementReview',
  training: 'trainingCourse',
  trainingcourse: 'trainingCourse',
  training_course: 'trainingCourse',
  process: 'businessProcess',
  businessprocess: 'businessProcess',
  business_process: 'businessProcess',
  requirement: 'requirement',
  evidence: 'evidence',
  bcp: 'bcp',
  bia: 'bia',
  workflowdefinition: 'workflowDefinition',
  workflow_definition: 'workflowDefinition',
};

/** Normalize a user-facing entity type (snake_case, camelCase or spaces) to an entity picker type. */
export function entityTypeFromValue(value: unknown, _isSourceType = false): EntityType | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!normalized) return undefined;
  return ENTITY_TYPE_MAP[normalized] ?? ENTITY_TYPE_MAP[normalized.replace(/_/g, '')];
}

/**
 * Resolve the EntityPicker configuration for a form field.
 * `entityId` and `sourceId` are dynamic: their target entity type is derived
 * from the sibling `entityType` / `sourceType` selector.
 */
export function getEntityPickerConfig(
  fieldKey: string,
  formData: Record<string, unknown> = {},
): EntityPickerConfig | undefined {
  const staticConfig = STATIC_PICKER_CONFIG[fieldKey];
  if (staticConfig) return staticConfig;

  if (fieldKey === 'entityId') {
    const entityType = entityTypeFromValue(formData.entityType);
    return entityType ? { entityType, labelKey: 'ismsPhase6.fields.entity' } : undefined;
  }

  if (fieldKey === 'sourceId') {
    const entityType = entityTypeFromValue(formData.sourceType, true);
    return entityType ? { entityType, labelKey: 'ismsPhase6.fields.source' } : undefined;
  }

  return undefined;
}

/** Extract the raw id from a picker result, a legacy string id, or nullish values. */
export function extractEntityId(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return undefined;
}

/**
 * Merge picker values into the form payload.
 * - single selection `{id,label}` -> raw id
 * - multi selection `EntityPickerResult[]` -> array of ids
 * - explicit `null` -> `null` (cleared nullable reference)
 * - legacy string ids are passed through
 */
export function mergeEntityPickerValues(
  formData: Record<string, unknown>,
  pickerValues: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...formData };

  Object.entries(pickerValues).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      payload[key] = value
        .map((entry) => extractEntityId(entry))
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    } else if (value === null) {
      payload[key] = null;
    } else if (typeof value === 'string' && value.length > 0) {
      payload[key] = value;
    } else if (value && typeof value === 'object' && 'id' in value) {
      const id = extractEntityId(value);
      if (id) payload[key] = id;
    }
  });

  return payload;
}

/**
 * Drop empty values while preserving explicit `null` for reference fields so
 * the backend can remove a nullable user/entity relation.
 */
export function pruneEmptyPayloadValues(payload: Record<string, unknown>): Record<string, unknown> {
  const pruned: Record<string, unknown> = { ...payload };

  Object.keys(pruned).forEach((key) => {
    const value = pruned[key];
    if (value === undefined || value === '') {
      delete pruned[key];
    } else if (value === null && !ENTITY_REFERENCE_FIELDS.has(key)) {
      delete pruned[key];
    }
  });

  return pruned;
}

/** Resolve the persisted selection for a single-select picker, preferring labels already loaded. */
export function resolvePickerValue(
  stored: unknown,
  raw: unknown,
): EntityPickerResult | null {
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return stored as EntityPickerResult;
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return { id: raw, label: raw };
  }
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return raw as EntityPickerResult;
  }
  return null;
}

/** Resolve the persisted selection for a multi-select picker, supporting legacy comma-separated ids. */
export function resolvePickerValues(stored: unknown, raw: unknown): EntityPickerResult[] {
  if (Array.isArray(stored)) return stored as EntityPickerResult[];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((id) => ({ id, label: id }));
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) =>
      typeof entry === 'string' ? { id: entry, label: entry } : (entry as EntityPickerResult),
    );
  }
  return [];
}
