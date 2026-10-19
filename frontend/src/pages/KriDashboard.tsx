import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { phase6Api, type KriBoardItem, type KriBoardResponse } from '../services/api';
import { useI18n } from '../context/I18nContext';

type BoardType = 'KPI' | 'KRI' | 'KCI';

const statusStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  none: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const trendGlyph: Record<string, string> = { up: '↑', down: '↓', stable: '→', none: '–' };

function Sparkline({ points }: { points: Array<{ measuredAt: string; value: number }> }) {
  if (points.length < 2) return <span className="text-gray-400">–</span>;
  const width = 96;
  const height = 24;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return <svg width={width} height={height} role="img" aria-hidden className="text-gray-500 dark:text-gray-400"><polyline points={coords.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export default function KriDashboard() {
  const { t } = useI18n();
  const [boardType, setBoardType] = useState<BoardType>('KRI');
  const [board, setBoard] = useState<KriBoardResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await phase6Api.kriBoard(boardType);
      setBoard(response.data);
    } catch {
      setError(t('kri.loadError'));
    } finally {
      setBusy(false);
    }
  }, [boardType, t]);

  useEffect(() => { void load(); }, [load]);

  const formatValue = (value: number | null | undefined, unit: string | null) =>
    value === null || value === undefined ? '–' : `${value}${unit ? ` ${unit}` : ''}`;

  const thresholdLabel = (item: KriBoardItem) => {
    const parts: string[] = [];
    if (item.thresholds.criticalMin !== undefined || item.thresholds.warningMin !== undefined) parts.push(`min ${item.thresholds.criticalMin ?? item.thresholds.warningMin}`);
    if (item.thresholds.criticalMax !== undefined || item.thresholds.warningMax !== undefined) parts.push(`max ${item.thresholds.criticalMax ?? item.thresholds.warningMax}`);
    return parts.length ? parts.join(' / ') : '–';
  };

  const statusOf = (item: KriBoardItem) => (!item.latestValue ? 'noData' : item.breachStatus);

  return <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('kri.title')}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('kri.description')}</p>
    </header>

    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="kri-type">{t('kri.typeLabel')}</label>
      <select id="kri-type" value={boardType} onChange={(event) => setBoardType(event.target.value as BoardType)} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800">
        {(['KRI', 'KPI', 'KCI'] as BoardType[]).map((type) => <option key={type} value={type}>{t(`kri.types.${type}`)}</option>)}
      </select>
      <button onClick={() => void load()} disabled={busy} className="rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('kri.refresh')}</button>
      <Link to="/isms-operations" className="ml-auto text-sm text-primary-700 hover:underline dark:text-primary-300">{t('kri.manageMetrics')}</Link>
    </div>

    {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    {board && <section aria-label={t('kri.summaryLabel')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(['critical', 'warning', 'none', 'noData'] as const).map((key) => (
        <div key={key} className={`rounded-lg p-4 text-center ${statusStyles[key === 'none' ? 'none' : key === 'noData' ? 'warning' : key]}`}>
          <div className="text-2xl font-bold">{board.summary[key]}</div>
          <div className="mt-1 text-xs">{t(`kri.status.${key}`)}</div>
        </div>
      ))}
    </section>}

    <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {board && board.items.length ? <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.name')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.latest')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.thresholds')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.trend')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.history')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('kri.columns.measuredAt')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {board.items.map((item) => {
            const status = statusOf(item);
            return <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-4 py-3 text-sm"><span className="font-medium text-gray-900 dark:text-white">{item.name}</span><div className="text-xs text-gray-500">{item.displayId}</div></td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status === 'noData' ? 'none' : status]}`}>{t(`kri.status.${status}`)}</span>
                <div className="mt-1">{formatValue(item.latestValue?.value, item.unit)}</div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{thresholdLabel(item)}</td>
              <td className="px-4 py-3 text-sm" title={t(`kri.trend.${item.trend}`)}>{trendGlyph[item.trend] ?? '–'}</td>
              <td className="px-4 py-3"><Sparkline points={item.sparkline} /></td>
              <td className="px-4 py-3 text-sm text-gray-500">{item.latestValue ? new Date(item.latestValue.measuredAt).toLocaleDateString() : '–'}</td>
            </tr>;
          })}
        </tbody>
      </table> : <p className="p-6 text-sm text-gray-500">{busy ? t('kri.loading') : t('kri.noIndicators')}</p>}
    </section>
  </main>;
}
