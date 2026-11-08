import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { adminApi, DatabaseImportMode, DatabaseImportResult, SafeDatabaseConfig } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { formatApiError } from '../utils/apiError';

const extractFileName = (contentDisposition?: string) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `asset-management-portable-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
};

const AdminDatabase = () => {
  const { t } = useI18n();
  const [config, setConfig] = useState<SafeDatabaseConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [mode, setMode] = useState<DatabaseImportMode>('dryRun');
  const [replaceConfirmation, setReplaceConfirmation] = useState('');
  const [result, setResult] = useState<DatabaseImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const replaceConfirmed = mode !== 'replace' || replaceConfirmation === t('databaseAdmin.replaceConfirmationPhrase');
  const rowCountEntries = useMemo(() => Object.entries(result?.rowCounts ?? {}).sort(([a], [b]) => a.localeCompare(b)), [result]);

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-database', defaultSort: { column: 'model', direction: 'asc' } });

  const sortedRowCountEntries = useMemo(() => {
    if (!sort.column) return rowCountEntries;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (entry: [string, number]) => {
      if (sort.column === 'model') return entry[0].toLowerCase();
      if (sort.column === 'count') return String(entry[1]);
      return '';
    };
    return [...rowCountEntries].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [rowCountEntries, sort]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    setError('');
    try {
      const { data } = await adminApi.getDatabaseConfig();
      setConfig(data);
    } catch (err) {
      setError(formatApiError(err, t('databaseAdmin.messages.configError'), t('common.referenceId')));
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => { void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial admin database config load only.
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage('');
    setError('');
    try {
      const response = await adminApi.exportDatabase();
      const blob = response.data instanceof Blob ? response.data : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = extractFileName(response.headers?.['content-disposition']);
      link.click();
      URL.revokeObjectURL(url);
      setMessage(t('databaseAdmin.messages.exportSuccess'));
    } catch (err) {
      setError(formatApiError(err, t('databaseAdmin.messages.exportError'), t('common.referenceId')));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBackupFile(event.target.files?.[0] ?? null);
    setResult(null);
    setMessage('');
    setError('');
  };

  const handleImport = async () => {
    if (!backupFile) {
      setError(t('databaseAdmin.messages.fileRequired'));
      return;
    }
    if (!replaceConfirmed) {
      setError(t('databaseAdmin.messages.replaceConfirmationRequired'));
      return;
    }

    setImporting(true);
    setMessage('');
    setError('');
    setResult(null);
    try {
      const { data } = await adminApi.importDatabase(backupFile, mode);
      setResult(data);
      setMessage(mode === 'dryRun' ? t('databaseAdmin.messages.dryRunSuccess') : t('databaseAdmin.messages.importSuccess'));
    } catch (err) {
      setError(formatApiError(err, t('databaseAdmin.messages.importError'), t('common.referenceId')));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('databaseAdmin.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('databaseAdmin.description')}</p>
      </div>

      {message && <div className="rounded bg-status-info-bg p-3 text-sm text-status-info-fg">{message}</div>}
      {error && <div className="rounded bg-status-critical-bg p-3 text-sm text-status-critical-fg">{error}</div>}

      <section className="bg-surface-default rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{t('databaseAdmin.configTitle')}</h2>
          <button onClick={loadConfig} disabled={loadingConfig} className="px-3 py-2 rounded bg-surface-sunken text-text-primary hover:bg-surface-hover disabled:opacity-50">
            {loadingConfig ? t('common.loading') : t('databaseAdmin.refreshConfig')}
          </button>
        </div>
        {loadingConfig && <p className="text-sm text-text-secondary">{t('common.loading')}</p>}
        {config && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              [t('databaseAdmin.provider'), config.provider],
              [t('databaseAdmin.databaseUrlSource'), config.databaseUrlSource],
              [t('databaseAdmin.providerSwitchingMode'), config.providerSwitchingMode],
              [t('databaseAdmin.portableBackupFormat'), config.portableBackupFormat],
              [t('databaseAdmin.prismaSchema'), config.prismaSchema],
              [t('databaseAdmin.jsonCompatibilityMode'), config.jsonCompatibilityMode],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-border-subtle p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</div>
                <div className="mt-1 break-words text-text-primary">{value}</div>
              </div>
            ))}
            {config.limitations.length > 0 && (
              <div className="md:col-span-2 rounded border border-border-subtle bg-status-warn-bg p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-status-warn-fg">{t('databaseAdmin.limitations')}</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-status-warn-fg">
                  {config.limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-surface-default rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('databaseAdmin.exportTitle')}</h2>
        <p className="text-sm text-text-secondary">{t('databaseAdmin.exportDescription')}</p>
        <button onClick={handleExport} disabled={exporting} className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-surface-disabled disabled:text-text-muted">
          {exporting ? t('databaseAdmin.exporting') : t('databaseAdmin.exportButton')}
        </button>
      </section>

      <section className="bg-surface-default rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('databaseAdmin.importTitle')}</h2>
        <p className="text-sm text-text-secondary">{t('databaseAdmin.importDescription')}</p>
        <label className="block text-sm font-medium text-text-primary">
          {t('databaseAdmin.backupFile')}
          <input type="file" accept="application/json,.json" onChange={handleFileChange} className="mt-1 block w-full text-sm text-text-primary" />
        </label>
        <label className="block text-sm font-medium text-text-primary">
          {t('databaseAdmin.importMode')}
          <select value={mode} onChange={(event) => { setMode(event.target.value as DatabaseImportMode); setReplaceConfirmation(''); }} className="mt-1 w-full rounded border-border-subtle">
            <option value="dryRun">{t('databaseAdmin.modes.dryRun')}</option>
            <option value="append">{t('databaseAdmin.modes.append')}</option>
            <option value="replace">{t('databaseAdmin.modes.replace')}</option>
          </select>
        </label>
        {mode === 'replace' && (
          <div className="rounded border border-border-subtle bg-status-critical-bg p-4">
            <p className="text-sm font-medium text-status-critical-fg">{t('databaseAdmin.replaceWarning')}</p>
            <label className="mt-3 block text-sm font-medium text-status-critical-fg">
              {t('databaseAdmin.replaceConfirmationLabel')}
              <input value={replaceConfirmation} onChange={(event) => setReplaceConfirmation(event.target.value)} className="mt-1 w-full rounded border-critical-300" />
            </label>
          </div>
        )}
        <button onClick={handleImport} disabled={importing || !backupFile || !replaceConfirmed} className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-surface-disabled disabled:text-text-muted">
          {importing ? t('databaseAdmin.importing') : t('databaseAdmin.importButton')}
        </button>
      </section>

      {result && (
        <section className="bg-surface-default rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{t('databaseAdmin.resultTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium text-text-primary">{t('databaseAdmin.resultMode')}:</span> <span>{result.dryRun ? t('databaseAdmin.modes.dryRun') : result.mode}</span></div>
            <div><span className="font-medium text-text-primary">{t('databaseAdmin.resultChecksum')}:</span> <span className="break-all">{result.checksum}</span></div>
            <div><span className="font-medium text-text-primary">{t('databaseAdmin.resultFormat')}:</span> <span>{result.format}</span></div>
            <div><span className="font-medium text-text-primary">{t('databaseAdmin.validation')}:</span> <span className="text-status-ok-fg">{t('databaseAdmin.validationOk')}</span></div>
          </div>
          <div>
            <h3 className="font-medium text-text-primary">{t('databaseAdmin.rowCounts')}</h3>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-border-subtle">
              <table className="min-w-full divide-y divide-border-subtle text-sm">
                <thead className="bg-surface-sunken">
                  <tr>
                    <SortableTh column="model" label={t('databaseAdmin.table.model')} activeColumn={sort.column} direction={sort.column === 'model' ? sort.direction : ''} onSort={toggleSort} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-primary" />
                    <SortableTh column="count" label={t('databaseAdmin.table.count')} activeColumn={sort.column} direction={sort.column === 'count' ? sort.direction : ''} onSort={toggleSort} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-primary" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {sortedRowCountEntries.map(([model, count]) => (
                    <tr key={model}><td className="px-3 py-2 font-medium text-text-primary">{model}</td><td className="px-3 py-2 text-right text-text-primary">{count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminDatabase;
