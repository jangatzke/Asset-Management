import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { costPlanningApi } from '../services/api';

type Supplier = { id: string; legalName: string; displayId: string };
type ManualItem = { title: string; category: string; investmentType: string; plannedAmount: string; currency: string; supplierId: string; supplierName: string };

const money = (value: string | number | null | undefined, currency = 'EUR') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0));
const emptyManual = (): ManualItem => ({ title: '', category: 'hardware', investmentType: 'new_acquisition', plannedAmount: '', currency: 'EUR', supplierId: '', supplierName: '' });
const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  const responseError = error.response?.data?.error;
  const detail = responseError?.details?.[0]?.message;
  return detail || responseError?.message || fallback;
};

const CostPlanning = () => {
  const { t } = useI18n();
  const [years, setYears] = useState<any[]>([]);
  const [fiscalYearLabel, setFiscalYearLabel] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<ManualItem>(emptyManual);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const selectAllCandidatesCheckboxRef = useRef<HTMLInputElement>(null);

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

  const loadSuppliers = async (search = supplierSearch) => {
    try {
      const { data } = await costPlanningApi.searchSuppliers({ search: search || undefined, limit: 50 });
      setSuppliers(data.data ?? []);
    } catch (error) {
      setMessage(apiErrorMessage(error, t('costPlanning.supplierLoadError')));
    }
  };

  useEffect(() => { void loadYears().catch((error) => setMessage(apiErrorMessage(error, t('costPlanning.loadYearsError'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial fiscal-year list load only; uses current translation fallback for this mount.
  }, []);
  useEffect(() => { void ensurePlan().catch((error) => setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Plan refresh is intentionally keyed to fiscalYearLabel only.
  }, [fiscalYearLabel]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSuppliers(supplierSearch); }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Supplier search should reload only when its search term changes.
  }, [supplierSearch]);

  const summary = useMemo(() => plan?.summary ?? { plannedAmount: '0', knownAmount: '0', acquiredAmount: '0', openAmount: '0', itemCount: 0 }, [plan]);
  const selectableCandidateKeys = useMemo(() => candidates.filter((candidate) => !candidate.alreadyInPlan).map((candidate) => candidate.candidateKey), [candidates]);
  const selectedVisibleCandidateCount = useMemo(() => selected.filter((candidateKey) => selectableCandidateKeys.includes(candidateKey)).length, [selected, selectableCandidateKeys]);
  const allSelectableCandidatesSelected = selectableCandidateKeys.length > 0 && selectedVisibleCandidateCount === selectableCandidateKeys.length;
  const isCandidateSelectionIndeterminate = selectedVisibleCandidateCount > 0 && !allSelectableCandidatesSelected;

  useEffect(() => {
    if (selectAllCandidatesCheckboxRef.current) selectAllCandidatesCheckboxRef.current.indeterminate = isCandidateSelectionIndeterminate;
  }, [isCandidateSelectionIndeterminate]);

  const toggleCandidate = (candidateKey: string, checked: boolean) => {
    setSelected((current) => checked
      ? current.includes(candidateKey) ? current : [...current, candidateKey]
      : current.filter((key) => key !== candidateKey));
  };

  const toggleAllVisibleCandidates = () => {
    setSelected((current) => {
      const next = new Set(current);
      const shouldDeselect = selectableCandidateKeys.length > 0 && selectableCandidateKeys.every((candidateKey) => next.has(candidateKey));
      selectableCandidateKeys.forEach((candidateKey) => shouldDeselect ? next.delete(candidateKey) : next.add(candidateKey));
      return [...next];
    });
  };

  const takeover = async () => {
    if (!plan || selected.length === 0) return;
    try {
      await costPlanningApi.takeOverCandidates(plan.id, selected);
      setSelected([]);
      await ensurePlan();
    } catch (error) { setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))); }
  };

  const createSupplier = async () => {
    const legalName = supplierSearch.trim();
    if (!legalName) return;
    setIsCreatingSupplier(true);
    setMessage('');
    try {
      const { data } = await costPlanningApi.createSupplier({ legalName });
      setSuppliers((current) => [data, ...current.filter((supplier) => supplier.id !== data.id)]);
      setManual((current) => ({ ...current, supplierId: data.id, supplierName: data.legalName }));
      setSupplierSearch(data.legalName);
      setMessage(t('costPlanning.supplierCreated'));
    } catch (error) {
      setMessage(apiErrorMessage(error, t('costPlanning.supplierCreateError')));
    } finally { setIsCreatingSupplier(false); }
  };

  const createManual = async () => {
    if (!plan) return;
    if (!manual.title.trim() || !Number.isFinite(Number(manual.plannedAmount)) || Number(manual.plannedAmount) <= 0) {
      setMessage(t('costPlanning.manualValidationError'));
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      await costPlanningApi.createManualItem(plan.id, {
        ...manual,
        title: manual.title.trim(),
        plannedAmount: Number(manual.plannedAmount),
        supplierId: manual.supplierId || undefined,
        supplierName: manual.supplierId ? undefined : manual.supplierName.trim() || undefined,
      });
      setManual(emptyManual());
      setSupplierSearch('');
      await ensurePlan();
      setMessage(t('costPlanning.manualCreated'));
    } catch (error) {
      setMessage(apiErrorMessage(error, t('costPlanning.manualCreateError')));
    } finally { setIsSubmitting(false); }
  };

  const exportCsv = async () => {
    if (!plan) return;
    try {
      const response = await costPlanningApi.exportCsv(plan.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${plan.displayId}-cost-plan.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))); }
  };

  const markDone = async (itemId: string) => { try { await costPlanningApi.markDone(itemId); await ensurePlan(); } catch (error) { setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))); } };
  const markAcquired = async (itemId: string) => { const invoiceNumber = window.prompt(t('costPlanning.invoiceNumberPrompt')); const invoiceDate = window.prompt(t('costPlanning.invoiceDatePrompt')); if (invoiceNumber && invoiceDate) { try { await costPlanningApi.markAcquired(itemId, { invoiceNumber, invoiceDate: new Date(invoiceDate).toISOString() }); await ensurePlan(); } catch (error) { setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))); } } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('costPlanning.title')}</h1>
        <select value={fiscalYearLabel} onChange={(e) => setFiscalYearLabel(e.target.value)} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white">
          {years.map((year) => <option key={year.label} value={year.label}>{year.label}</option>)}
        </select>
      </div>
      {message && <div role="alert" className="rounded bg-yellow-50 p-3 text-yellow-800">{message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[[t('costPlanning.planned'), summary.plannedAmount], [t('costPlanning.known'), summary.knownAmount], [t('costPlanning.acquired'), summary.acquiredAmount], [t('costPlanning.open'), summary.openAmount]].map(([label, value]) => <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><h3 className="text-sm text-gray-500 dark:text-gray-400">{label}</h3><p className="text-2xl font-bold dark:text-white">{money(value, plan?.currency || 'EUR')}</p></div>)}
      </div>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.yearlyPlanItems')}</h2><button onClick={exportCsv} className="px-3 py-2 rounded bg-gray-700 text-white">{t('costPlanning.csvExport')}</button></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th>{t('costPlanning.item')}</th><th>{t('costPlanning.status')}</th><th>{t('costPlanning.category')}</th><th>{t('costPlanning.amount')}</th><th>{t('costPlanning.due')}</th><th>{t('costPlanning.actions')}</th></tr></thead><tbody>{plan?.items?.map((item: any) => <tr key={item.id} className="border-t dark:border-gray-700"><td className="py-2 dark:text-white"><span className="font-medium">{item.displayId}</span> {item.title}</td><td>{item.status}</td><td>{item.category}</td><td>{money(item.knownAmount || item.plannedAmount, item.currency)}</td><td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td><td className="space-x-2"><button onClick={() => markAcquired(item.id)} className="text-blue-600">{t('costPlanning.markAcquired')}</button><button onClick={() => markDone(item.id)} className="text-green-600">{t('costPlanning.done')}</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold dark:text-white mb-3">{t('costPlanning.manualPlannedAcquisition')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input aria-label={t('costPlanning.titleField')} placeholder={t('costPlanning.titleField')} value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          <select aria-label={t('costPlanning.category')} value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white">{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <input aria-label={t('costPlanning.amount')} inputMode="decimal" placeholder={t('costPlanning.amount')} value={manual.plannedAmount} onChange={(e) => setManual({ ...manual, plannedAmount: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          <div className="space-y-1"><input aria-label={t('costPlanning.supplierSearch')} list="cost-plan-suppliers" placeholder={t('costPlanning.supplierSearch')} value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setManual((current) => ({ ...current, supplierId: '', supplierName: e.target.value })); }} onBlur={() => { const supplier = suppliers.find((candidate) => candidate.legalName.toLocaleLowerCase() === supplierSearch.trim().toLocaleLowerCase()); if (supplier) setManual((current) => ({ ...current, supplierId: supplier.id, supplierName: supplier.legalName })); }} className="w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white" /><datalist id="cost-plan-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.legalName}>{supplier.displayId}</option>)}</datalist>{supplierSearch.trim() && !suppliers.some((supplier) => supplier.legalName.toLocaleLowerCase() === supplierSearch.trim().toLocaleLowerCase()) && <button type="button" onClick={createSupplier} disabled={isCreatingSupplier} className="text-sm text-blue-600 disabled:text-gray-400">{isCreatingSupplier ? '…' : `${t('costPlanning.createSupplier')}: ${supplierSearch.trim()}`}</button>}</div>
          <button onClick={createManual} disabled={isSubmitting || !plan} className="rounded bg-blue-600 text-white px-3 py-2 disabled:bg-gray-400">{isSubmitting ? '…' : t('costPlanning.add')}</button>
        </div>
      </section>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.candidates')}</h2><button onClick={takeover} disabled={selected.length === 0} className="px-3 py-2 rounded bg-blue-600 disabled:bg-gray-300 text-white">{t('costPlanning.takeOverSelected')}</button></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th><input ref={selectAllCandidatesCheckboxRef} type="checkbox" aria-label={t('costPlanning.selectAllCandidates')} aria-checked={isCandidateSelectionIndeterminate ? 'mixed' : allSelectableCandidatesSelected} checked={allSelectableCandidatesSelected} disabled={selectableCandidateKeys.length === 0} onChange={toggleAllVisibleCandidates} /></th><th>{t('costPlanning.source')}</th><th>{t('costPlanning.titleField')}</th><th>{t('costPlanning.reason')}</th><th>{t('costPlanning.amount')}</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.candidateKey} className="border-t dark:border-gray-700"><td><input type="checkbox" disabled={candidate.alreadyInPlan} checked={selected.includes(candidate.candidateKey)} onChange={(e) => toggleCandidate(candidate.candidateKey, e.target.checked)} /></td><td className="py-2 dark:text-white">{candidate.sourceDisplayId} {candidate.sourceLabel}</td><td>{candidate.title}</td><td>{candidate.alreadyInPlan ? t('costPlanning.alreadyInPlan') : candidate.relevanceReason}</td><td>{candidate.plannedAmount ? money(candidate.plannedAmount, candidate.currency) : '—'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
};

export default CostPlanning;
