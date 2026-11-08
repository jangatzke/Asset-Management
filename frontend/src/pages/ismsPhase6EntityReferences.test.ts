/**
 * ismsPhase6EntityReferences tests.
 *
 * Proves:
 *  - static reference fields map to the expected picker entity type/label
 *  - dynamic entityId/sourceId pickers derive their type from the sibling selector
 *  - entity type values are normalised (camelCase, snake_case, spaces)
 *  - picker selections are reduced to raw ids in the submit payload
 *  - explicit `null` is preserved for cleared nullable references while
 *    other empty values are pruned
 *  - persisted ids resolve to readable single/multi picker values
 */
import {
  ENTITY_REFERENCE_FIELDS,
  entityTypeFromValue,
  getEntityPickerConfig,
  extractEntityId,
  mergeEntityPickerValues,
  pruneEmptyPayloadValues,
  resolvePickerValue,
  resolvePickerValues,
} from './ismsPhase6EntityReferences';

describe('ENTITY_REFERENCE_FIELDS', () => {
  it('contains every Phase 6 reference field that is rendered with EntityPicker', () => {
    for (const key of [
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
    ]) {
      expect(ENTITY_REFERENCE_FIELDS.has(key)).toBe(true);
    }
  });
});

describe('entityTypeFromValue', () => {
  it('normalises camelCase, snake_case and spaced values', () => {
    expect(entityTypeFromValue('trainingCourse')).toBe('trainingCourse');
    expect(entityTypeFromValue('training_course')).toBe('trainingCourse');
    expect(entityTypeFromValue('management review')).toBe('managementReview');
    expect(entityTypeFromValue('audit_plan')).toBe('auditPlan');
    expect(entityTypeFromValue('BusinessProcess')).toBe('businessProcess');
  });

  it('returns undefined for empty or unknown values', () => {
    expect(entityTypeFromValue('')).toBeUndefined();
    expect(entityTypeFromValue(null)).toBeUndefined();
    expect(entityTypeFromValue('unknown')).toBeUndefined();
  });
});

describe('getEntityPickerConfig', () => {
  it('maps static user/course/definition references to the picker config', () => {
    expect(getEntityPickerConfig('ownerId')).toEqual({
      entityType: 'user',
      labelKey: 'ismsPhase6.fields.owner',
    });
    expect(getEntityPickerConfig('chairId')).toEqual({
      entityType: 'user',
      labelKey: 'ismsPhase6.fields.chair',
    });
    expect(getEntityPickerConfig('userId')).toEqual({
      entityType: 'user',
      labelKey: 'ismsPhase6.fields.assignee',
    });
    expect(getEntityPickerConfig('courseId')).toEqual({
      entityType: 'trainingCourse',
      labelKey: 'ismsPhase6.fields.course',
    });
    expect(getEntityPickerConfig('definitionId')).toEqual({
      entityType: 'workflowDefinition',
      labelKey: 'ismsPhase6.fields.workflow_definition',
    });
  });

  it('maps multi-select references', () => {
    expect(getEntityPickerConfig('auditorIds')).toMatchObject({
      entityType: 'user',
      labelKey: 'ismsPhase6.fields.auditors',
      multi: true,
    });
    expect(getEntityPickerConfig('businessProcesses')).toMatchObject({
      entityType: 'businessProcess',
      multi: true,
    });
    expect(getEntityPickerConfig('resources')).toMatchObject({
      entityType: 'asset',
      multi: true,
    });
    expect(getEntityPickerConfig('dependencies')).toMatchObject({
      entityType: 'supplier',
      multi: true,
    });
  });

  it('derives the entityId picker from entityType', () => {
    expect(getEntityPickerConfig('entityId', { entityType: 'risk' })).toEqual({
      entityType: 'risk',
      labelKey: 'ismsPhase6.fields.entity',
    });
    expect(getEntityPickerConfig('entityId', { entityType: 'incident' })).toEqual({
      entityType: 'incident',
      labelKey: 'ismsPhase6.fields.entity',
    });
    expect(getEntityPickerConfig('entityId', { entityType: 'unknown' })).toBeUndefined();
    expect(getEntityPickerConfig('entityId', {})).toBeUndefined();
  });

  it('derives the sourceId picker from sourceType', () => {
    expect(getEntityPickerConfig('sourceId', { sourceType: 'audit' })).toEqual({
      entityType: 'auditPlan',
      labelKey: 'ismsPhase6.fields.source',
    });
    expect(getEntityPickerConfig('sourceId', { sourceType: 'training' })).toEqual({
      entityType: 'trainingCourse',
      labelKey: 'ismsPhase6.fields.source',
    });
    expect(getEntityPickerConfig('sourceId', { sourceType: 'other' })).toBeUndefined();
  });

  it('returns undefined for non-reference fields', () => {
    expect(getEntityPickerConfig('title')).toBeUndefined();
    expect(getEntityPickerConfig('status')).toBeUndefined();
    expect(getEntityPickerConfig('description')).toBeUndefined();
  });
});

describe('extractEntityId', () => {
  it('extracts ids from strings and picker results', () => {
    expect(extractEntityId('u-1')).toBe('u-1');
    expect(extractEntityId({ id: 'u-1', label: 'Alice' })).toBe('u-1');
  });

  it('ignores empty and nullish values', () => {
    expect(extractEntityId('')).toBeUndefined();
    expect(extractEntityId(null)).toBeUndefined();
    expect(extractEntityId(undefined)).toBeUndefined();
    expect(extractEntityId({})).toBeUndefined();
  });
});

describe('mergeEntityPickerValues', () => {
  it('reduces a single selection to its raw id', () => {
    const payload = mergeEntityPickerValues(
      { title: 'CAPA 1' },
      { ownerId: { id: 'u-1', label: 'Alice Admin' } },
    );

    expect(payload).toEqual({ title: 'CAPA 1', ownerId: 'u-1' });
  });

  it('reduces multi selections to arrays of ids', () => {
    const payload = mergeEntityPickerValues(
      {},
      {
        auditorIds: [
          { id: 'u-1', label: 'Alice' },
          { id: 'u-2', label: 'Bob' },
        ],
      },
    );

    expect(payload).toEqual({ auditorIds: ['u-1', 'u-2'] });
  });

  it('keeps explicit null so nullable references can be cleared', () => {
    const payload = mergeEntityPickerValues({ ownerId: 'u-1' }, { ownerId: null });
    expect(payload).toEqual({ ownerId: null });
  });

  it('passes through legacy string ids', () => {
    const payload = mergeEntityPickerValues({}, { ownerId: 'u-legacy' });
    expect(payload).toEqual({ ownerId: 'u-legacy' });
  });
});

describe('pruneEmptyPayloadValues', () => {
  it('removes empty strings, undefined, and non-reference nulls', () => {
    const pruned = pruneEmptyPayloadValues({
      title: 'CAPA 1',
      description: '',
      notes: undefined,
      unit: null,
    });

    expect(pruned).toEqual({ title: 'CAPA 1' });
  });

  it('preserves null for reference fields so clearing survives', () => {
    const pruned = pruneEmptyPayloadValues({ ownerId: null, chairId: null, status: 'open' });

    expect(pruned).toEqual({ ownerId: null, chairId: null, status: 'open' });
  });

  it('preserves legitimate false and 0 values', () => {
    const pruned = pruneEmptyPayloadValues({ dataProtectionRelevant: false, rtoMinutes: 0 });

    expect(pruned).toEqual({ dataProtectionRelevant: false, rtoMinutes: 0 });
  });
});

describe('resolvePickerValue', () => {
  it('prefers a stored picker object so labels stay readable', () => {
    expect(resolvePickerValue({ id: 'u-1', label: 'Alice' }, 'u-1')).toEqual({
      id: 'u-1',
      label: 'Alice',
    });
  });

  it('falls back to the raw id when no label was loaded yet', () => {
    expect(resolvePickerValue(undefined, 'u-1')).toEqual({ id: 'u-1', label: 'u-1' });
  });

  it('returns null when nothing is selected', () => {
    expect(resolvePickerValue(undefined, undefined)).toBeNull();
    expect(resolvePickerValue(null, null)).toBeNull();
  });
});

describe('resolvePickerValues', () => {
  it('returns stored picker arrays as-is', () => {
    const stored = [{ id: 'u-1', label: 'Alice' }];
    expect(resolvePickerValues(stored, 'u-1')).toEqual(stored);
  });

  it('splits legacy comma-separated id strings', () => {
    expect(resolvePickerValues(undefined, 'u-1, u-2')).toEqual([
      { id: 'u-1', label: 'u-1' },
      { id: 'u-2', label: 'u-2' },
    ]);
  });

  it('maps legacy id arrays to picker results', () => {
    expect(resolvePickerValues(undefined, ['a-1', 'a-2'])).toEqual([
      { id: 'a-1', label: 'a-1' },
      { id: 'a-2', label: 'a-2' },
    ]);
  });

  it('returns an empty array when nothing is selected', () => {
    expect(resolvePickerValues(undefined, undefined)).toEqual([]);
  });
});
