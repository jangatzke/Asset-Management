import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { costPlanningApi } from '../services/api';

const money = (value: string | number | null | undefined, currency = 'EUR') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0));

const CostPlanning = () => {
  const { t } = useI18n();
  const [years, setYears] = useState<any[]>([]);
  const [fiscalYearLabel, setFiscalYearLabel] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState({ title: '', category: 'hardware', investmentType: 'new_acquisition', plannedAmount: '', currency: 'EUR', supplierName: '' });
  const [message, setMessage] = useState('');

  const categories = ['hardware', 'software', 'license', 'contract', 'maintenance', 'support', 'cloud', 'security', 'other'];

  const loadYears = async () => {
    const { data } = await costPlanningApi.years();
    setYears(data.years);
    setFiscalYearLabel(data.current.label);
  };

  const ensurePlan = async () => {
    if (!fiscalYearLabel) return;
    const { data } = await costPlanningApi.createPlan({ fiscalYearLabel });
    setPlan(data);
    const candidateResponse = await costPlanningApi.candidates({ fiscalYearLabel });
    setCandidates(candidateResponse.data);
  };

  useEffect(() => { loadYears().catch(() => setMessage(t('costPlanning.loadYearsError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial fiscal-year list load only; uses current translation fallback for this mount.
  }, []);
  useEffect(() => { ensurePlan().catch(() => setMessage(t('costPlanning.loadPlanError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Plan refresh is intentionally keyed to fiscalYearLabel only.
  }, [fiscalYearLabel]);

  const summary = useMemo(() => plan?.summary ?? { plannedAmount: '0', knownAmount: '0', acquiredAmount: '0', openAmount: '0', itemCount: 0 }, [plan]);

  const takeover = async () => {
    if (!plan || selected.length === 0) return;
    await costPlanningApi.takeOverCandidates(plan.id, selected);
    setSelected([]);
    await ensurePlan();
  };

  const createManual = async () => {
    if (!plan || !manual.title || !manual.plannedAmount) return;
    await costPlanningApi.createManualItem(plan.id, manual);
    setManual({ ...manual, title: '', plannedAmount: '', supplierName: '' });
    await ensurePlan();
  };

  const exportCsv = async () => {
    if (!plan) return;
    const response = await costPlanningApi.exportCsv(plan.id);
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.displayId}-cost-plan.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markDone = async (itemId: string) => { await costPlanningApi.markDone(itemId); await ensurePlan(); };
  const markAcquired = async (itemId: string) => { const invoiceNumber = window.prompt(t('costPlanning.invoiceNumberPrompt')); const invoiceDate = window.prompt(t('costPlanning.invoiceDatePrompt')); if (invoiceNumber && invoiceDate) { await costPlanningApi.markAcquired(itemId, { invoiceNumber, invoiceDate: new Date(invoiceDate).toISOString() }); await ensurePlan(); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('costPlanning.title')}</h1>
        <select value={fiscalYearLabel} onChange={(e) => setFiscalYearLabel(e.target.value)} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white">
          {years.map((year) => <option key={year.label} value={year.label}>{year.label}</option>)}
        </select>
      </div>
      {message && <div className="rounded bg-yellow-50 p-3 text-yellow-800">{message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [t('costPlanning.planned'), summary.plannedAmount], [t('costPlanning.known'), summary.knownAmount], [t('costPlanning.acquired'), summary.acquiredAmount], [t('costPlanning.open'), summary.openAmount],
        ].map(([label, value]) => <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><h3 className="text-sm text-gray-500 dark:text-gray-400">{label}</h3><p className="text-2xl font-bold dark:text-white">{money(value, plan?.currency || 'EUR')}</p></div>)}
      </div>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.yearlyPlanItems')}</h2><button onClick={exportCsv} className="px-3 py-2 rounded bg-gray-700 text-white">{t('costPlanning.csvExport')}</button></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th>{t('costPlanning.item')}</th><th>{t('costPlanning.status')}</th><th>{t('costPlanning.category')}</th><th>{t('costPlanning.amount')}</th><th>{t('costPlanning.due')}</th><th>{t('costPlanning.actions')}</th></tr></thead><tbody>{plan?.items?.map((item: any) => <tr key={item.id} className="border-t dark:border-gray-700"><td className="py-2 dark:text-white"><span className="font-medium">{item.displayId}</span> {item.title}</td><td>{item.status}</td><td>{item.category}</td><td>{money(item.knownAmount || item.plannedAmount, item.currency)}</td><td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td><td className="space-x-2"><button onClick={() => markAcquired(item.id)} className="text-blue-600">{t('costPlanning.markAcquired')}</button><button onClick={() => markDone(item.id)} className="text-green-600">{t('costPlanning.done')}</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold dark:text-white mb-3">{t('costPlanning.manualPlannedAcquisition')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3"><input placeholder={t('costPlanning.titleField')} value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" /><select value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white">{categories.map((c) => <option key={c}>{c}</option>)}</select><input placeholder={t('costPlanning.amount')} value={manual.plannedAmount} onChange={(e) => setManual({ ...manual, plannedAmount: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" /><input placeholder={t('costPlanning.supplier')} value={manual.supplierName} onChange={(e) => setManual({ ...manual, supplierName: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" /><button onClick={createManual} className="rounded bg-blue-600 text-white px-3 py-2">{t('costPlanning.add')}</button></div>
      </section>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.candidates')}</h2><button onClick={takeover} disabled={selected.length === 0} className="px-3 py-2 rounded bg-blue-600 disabled:bg-gray-300 text-white">{t('costPlanning.takeOverSelected')}</button></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th></th><th>{t('costPlanning.source')}</th><th>{t('costPlanning.titleField')}</th><th>{t('costPlanning.reason')}</th><th>{t('costPlanning.amount')}</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.candidateKey} className="border-t dark:border-gray-700"><td><input type="checkbox" disabled={candidate.alreadyInPlan} checked={selected.includes(candidate.candidateKey)} onChange={(e) => setSelected(e.target.checked ? [...selected, candidate.candidateKey] : selected.filter((key) => key !== candidate.candidateKey))} /></td><td className="py-2 dark:text-white">{candidate.sourceDisplayId} {candidate.sourceLabel}</td><td>{candidate.title}</td><td>{candidate.alreadyInPlan ? t('costPlanning.alreadyInPlan') : candidate.relevanceReason}</td><td>{candidate.plannedAmount ? money(candidate.plannedAmount, candidate.currency) : '—'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
};

export default CostPlanning;
