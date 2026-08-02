import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useI18n } from '../context/I18nContext';
import type { EntityHistoryEntry, EntityHistoryParams } from '../services/api';

type HistoryResponse = { data?: EntityHistoryEntry[] } | EntityHistoryEntry[];

interface EntityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: string | null;
  entityName?: string;
  loadHistory: (id: string, params?: EntityHistoryParams) => Promise<{ data: HistoryResponse }>;
  actions?: string[];
}

const defaultActions = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSESSMENT', 'RELATION_CHANGE', 'LIFECYCLE_CHANGE', 'CLOSE', 'REOPEN'];

const hiddenFieldKeys = new Set([
  'id',
  'entityId',
  'entityType',
  'actorId',
  'actorName',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'ipAddress',
  'userAgent',
  'oldStatus',
  'newStatus',
  'statusSummary',
  'summary',
]);

const noisyKeyPatterns = [
  /(^|_)id$/i,
  /ids$/i,
  /links?$/i,
  /relations?$/i,
  /payload$/i,
  /snapshot$/i,
  /metadata$/i,
  /password|secret|token/i,
];

const isPlainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasRenderableValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const shouldShowField = (field: string, change: unknown) => {
  if (hiddenFieldKeys.has(field)) return false;
  if (noisyKeyPatterns.some((pattern) => pattern.test(field))) return false;
  if (!isPlainObject(change)) return hasRenderableValue(change);
  const oldValue = change.old ?? change.oldValue ?? change.from;
  const newValue = change.new ?? change.newValue ?? change.to;
  return hasRenderableValue(oldValue) || hasRenderableValue(newValue);
};

const formatFieldLabel = (field: string) => field
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (char) => char.toUpperCase());

const formatValue = (value: unknown, emptyLabel: string): string => {
  if (value === null || value === undefined || value === '') return emptyLabel;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item, emptyLabel)).join(', ') : emptyLabel;
  if (isPlainObject(value)) {
    const compact = Object.entries(value)
      .filter(([, nestedValue]) => hasRenderableValue(nestedValue))
      .map(([key, nestedValue]) => `${formatFieldLabel(key)}: ${formatValue(nestedValue, emptyLabel)}`)
      .join(', ');
    return compact || emptyLabel;
  }
  return String(value);
};

export const EntityHistoryModal = ({ isOpen, onClose, entityId, entityName, loadHistory, actions = defaultActions }: EntityHistoryModalProps) => {
  const { t } = useI18n();
  const [entries, setEntries] = useState<EntityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !entityId) return;
    let ignore = false;
    setLoading(true);
    setError(null);
    const params: EntityHistoryParams = { limit: 100, offset: 0 };
    if (actionFilter) params.action = actionFilter;
    loadHistory(entityId, params)
      .then((response) => {
        if (ignore) return;
        const payload = response.data;
        setEntries(Array.isArray(payload) ? payload : payload.data ?? []);
      })
      .catch((err: any) => {
        if (!ignore) setError(err.response?.data?.error?.message || err.response?.data?.message || t('history.loadError'));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [actionFilter, entityId, isOpen, loadHistory, t]);

  useEffect(() => {
    if (!isOpen) {
      setActionFilter('');
      setExpandedEntryIds(new Set());
      setEntries([]);
      setError(null);
    }
  }, [isOpen]);

  const title = useMemo(() => {
    if (!entityName) return t('history.title');
    return `${t('history.title')}: ${entityName}`;
  }, [entityName, t]);

  const actionLabel = (action: string) => {
    const key = `history.actions.${action}`;
    const label = t(key);
    return label === key ? action.replace(/_/g, ' ') : label;
  };

  const fieldLabel = (field: string) => {
    const key = `history.fields.${field}`;
    const label = t(key);
    return label === key ? formatFieldLabel(field) : label;
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidthClassName="max-w-4xl">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="entity-history-action-filter">
            {t('history.actionFilter')}
          </label>
          <select
            id="entity-history-action-filter"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('common.all')}</option>
            {actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">{t('history.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">{t('history.empty')}</div>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto space-y-3">
            {entries.map((entry) => {
              const visibleChanges = entry.fieldChanges && isPlainObject(entry.fieldChanges)
                ? Object.fromEntries(Object.entries(entry.fieldChanges).filter(([field, change]) => shouldShowField(field, change)))
                : {};
              const hasVisibleChanges = Object.keys(visibleChanges).length > 0;
              const actorDisplay = entry.actorName || entry.actorId || t('history.system');
              const expanded = expandedEntryIds.has(entry.id);

              return (
                <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{actionLabel(entry.action)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500" title={actorDisplay}>{t('history.byActor').replace('{actor}', actorDisplay)}</span>
                      </div>
                      {entry.summary && <p className="text-sm text-gray-700 dark:text-gray-300">{entry.summary}</p>}
                      {hasVisibleChanges && (
                        <div className="mt-2">
                          <button type="button" onClick={() => toggleExpanded(entry.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            {t('history.changes')} ({Object.keys(visibleChanges).length})
                          </button>
                          {expanded && (
                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-1 pr-3 font-medium">{t('history.field')}</th>
                                    <th className="pb-1 pr-3 font-medium">{t('history.oldValue')}</th>
                                    <th className="pb-1 font-medium">{t('history.newValue')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(visibleChanges).map(([field, change]) => {
                                    const oldValue = isPlainObject(change) ? change.old ?? change.oldValue ?? change.from : undefined;
                                    const newValue = isPlainObject(change) ? change.new ?? change.newValue ?? change.to : change;
                                    return (
                                      <tr key={field} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                                        <td className="py-1 pr-3 align-top text-gray-700 dark:text-gray-300">{fieldLabel(field)}</td>
                                        <td className="py-1 pr-3 align-top text-gray-500 dark:text-gray-400 break-words">{formatValue(oldValue, t('history.emptyValue'))}</td>
                                        <td className="py-1 align-top text-gray-500 dark:text-gray-400 break-words">{formatValue(newValue, t('history.emptyValue'))}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

