import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { adminApi, DatabaseImportMode, DatabaseImportResult, SafeDatabaseConfig } from '../services/api';
import { useI18n } from '../context/I18nContext';

const extractFileName = (contentDisposition?: string) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `asset-management-portable-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
};

const extractErrorMessage = (err: unknown, fallback: string) => {
  const axiosError = err as AxiosError<{ error?: { message?: string }; message?: string }>;
  return axiosError.response?.data?.error?.message || axiosError.response?.data?.message || axiosError.message || fallback;
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

  const loadConfig = async () => {
    setLoadingConfig(true);
    setError('');
    try {
      const { data } = await adminApi.getDatabaseConfig();
      setConfig(data);
    } catch (err) {
      setError(extractErrorMessage(err, t('databaseAdmin.messages.configError')));
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
      setError(extractErrorMessage(err, t('databaseAdmin.messages.exportError')));
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
      setError(extractErrorMessage(err, t('databaseAdmin.messages.importError')));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('databaseAdmin.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('databaseAdmin.description')}</p>
      </div>

      {message && <div className="rounded bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">{message}</div>}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('databaseAdmin.configTitle')}</h2>
          <button onClick={loadConfig} disabled={loadingConfig} className="px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
            {loadingConfig ? t('common.loading') : t('databaseAdmin.refreshConfig')}
          </button>
        </div>
        {loadingConfig && <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</p>}
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
              <div key={label} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                <div className="mt-1 break-words text-gray-900 dark:text-gray-100">{value}</div>
              </div>
            ))}
            {config.limitations.length > 0 && (
              <div className="md:col-span-2 rounded border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
                <div className="text-xs font-medium uppercase tracking-wide text-yellow-800 dark:text-yellow-200">{t('databaseAdmin.limitations')}</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-yellow-900 dark:text-yellow-100">
                  {config.limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('databaseAdmin.exportTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('databaseAdmin.exportDescription')}</p>
        <button onClick={handleExport} disabled={exporting} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
          {exporting ? t('databaseAdmin.exporting') : t('databaseAdmin.exportButton')}
        </button>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('databaseAdmin.importTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('databaseAdmin.importDescription')}</p>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('databaseAdmin.backupFile')}
          <input type="file" accept="application/json,.json" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-700 dark:text-gray-200" />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('databaseAdmin.importMode')}
          <select value={mode} onChange={(event) => { setMode(event.target.value as DatabaseImportMode); setReplaceConfirmation(''); }} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white">
            <option value="dryRun">{t('databaseAdmin.modes.dryRun')}</option>
            <option value="append">{t('databaseAdmin.modes.append')}</option>
            <option value="replace">{t('databaseAdmin.modes.replace')}</option>
          </select>
        </label>
        {mode === 'replace' && (
          <div className="rounded border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{t('databaseAdmin.replaceWarning')}</p>
            <label className="mt-3 block text-sm font-medium text-red-900 dark:text-red-100">
              {t('databaseAdmin.replaceConfirmationLabel')}
              <input value={replaceConfirmation} onChange={(event) => setReplaceConfirmation(event.target.value)} className="mt-1 w-full rounded border-red-300 dark:bg-gray-700 dark:text-white" />
            </label>
          </div>
        )}
        <button onClick={handleImport} disabled={importing || !backupFile || !replaceConfirmed} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
          {importing ? t('databaseAdmin.importing') : t('databaseAdmin.importButton')}
        </button>
      </section>

      {result && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('databaseAdmin.resultTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium dark:text-white">{t('databaseAdmin.resultMode')}:</span> <span className="dark:text-gray-200">{result.dryRun ? t('databaseAdmin.modes.dryRun') : result.mode}</span></div>
            <div><span className="font-medium dark:text-white">{t('databaseAdmin.resultChecksum')}:</span> <span className="break-all dark:text-gray-200">{result.checksum}</span></div>
            <div><span className="font-medium dark:text-white">{t('databaseAdmin.resultFormat')}:</span> <span className="dark:text-gray-200">{result.format}</span></div>
            <div><span className="font-medium dark:text-white">{t('databaseAdmin.validation')}:</span> <span className="text-green-700 dark:text-green-300">{t('databaseAdmin.validationOk')}</span></div>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{t('databaseAdmin.rowCounts')}</h3>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rowCountEntries.map(([model, count]) => (
                    <tr key={model}><td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{model}</td><td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{count}</td></tr>
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
