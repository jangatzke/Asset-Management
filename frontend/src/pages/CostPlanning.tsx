import axios from 'axios';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../context/I18nContext';
import { costPlanningApi, assetApi } from '../services/api';
import { Modal } from '../components/Modal';
import {
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  DocumentArrowDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  FunnelIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

type Supplier = { id: string; legalName: string; displayId: string };
type ManualItem = { title: string; category: string; investmentType: string; plannedAmount: string; currency: string; supplierId: string; supplierName: string; quoteNumber: string; remark: string };

interface CostPlanItem {
  id: string;
  displayId: string;
  title: string;
  description?: string;
  category: string;
  investmentType: string;
  plannedAmount: number | string;
  knownAmount?: number | string | null;
  currency: string;
  plannedDate?: string;
  dueDate?: string;
  status: string;
  supplierId?: string;
  supplierName?: string;
  quoteNumber?: string;
  remark?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  acquiredAt?: string;
  completedAt?: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortConfig = { key: keyof CostPlanItem; direction: SortDirection };

const money = (value: string | number | null | undefined, currency = 'EUR') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0));
const emptyManual = (): ManualItem => ({ title: '', category: 'hardware', investmentType: 'new_acquisition', plannedAmount: '', currency: 'EUR', supplierId: '', supplierName: '', quoteNumber: '', remark: '' });
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
  const [manual, setManual] = useState<ManualItem>(emptyManual());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const selectAllCandidatesCheckboxRef = useRef<HTMLInputElement>(null);

  // Edit modal state for cost plan items
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostPlanItem | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CostPlanItem>>({});
  const [editSupplierSearch, setEditSupplierSearch] = useState('');
  const [editSuppliers, setEditSuppliers] = useState<Supplier[]>([]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dueDate', direction: null });

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    supplierName: '',
  });

  const categories = ['hardware', 'software', 'license', 'contract', 'maintenance', 'support', 'cloud', 'security', 'other'];

  const loadYears = async () => {
    const { data } = await costPlanningApi.years();
    setYears(data.years);
    const defaultLabel = data.next?.label || data.current?.label;
    setFiscalYearLabel(defaultLabel);
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

  const loadEditSuppliers = async (search: string) => {
    try {
      const { data } = await costPlanningApi.searchSuppliers({ search: search || undefined, limit: 50 });
      setEditSuppliers(data.data ?? []);
    } catch { /* ignore */ }
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
        quoteNumber: manual.quoteNumber || undefined,
        remark: manual.remark || undefined,
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
  const markAcquired = async (itemId: string) => {
    const invoiceNumber = window.prompt(t('costPlanning.invoiceNumberPrompt'));
    const invoiceDate = window.prompt(t('costPlanning.invoiceDatePrompt'));
    if (invoiceNumber && invoiceDate) {
      try {
        await costPlanningApi.markAcquired(itemId, { invoiceNumber, invoiceDate: new Date(invoiceDate).toISOString() });
        await ensurePlan();
      } catch (error) { setMessage(apiErrorMessage(error, t('costPlanning.loadPlanError'))); }
    }
  };

  // Edit item handlers
  const openEditModal = (item: CostPlanItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      description: item.description,
      category: item.category,
      investmentType: item.investmentType,
      plannedAmount: String(item.plannedAmount),
      knownAmount: item.knownAmount,
      currency: item.currency,
      dueDate: item.dueDate,
      status: item.status,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      quoteNumber: item.quoteNumber,
      remark: item.remark,
    });
    setEditSupplierSearch(item.supplierName || '');
    setEditModalOpen(true);
  };

  const handleEditSupplierSearch = (value: string) => {
    setEditSupplierSearch(value);
    setEditForm((prev) => ({ ...prev, supplierId: '', supplierName: value }));
    if (value.trim()) {
      loadEditSuppliers(value);
    } else {
      setEditSuppliers([]);
    }
  };

  const selectEditSupplier = (supplier: Supplier) => {
    setEditForm((prev) => ({ ...prev, supplierId: supplier.id, supplierName: supplier.legalName }));
    setEditSupplierSearch(supplier.legalName);
    setEditSuppliers([]);
  };

  const saveEdit = async () => {
    if (!editingItem || !editForm.title?.trim()) return;
    setEditSaving(true);
    try {
      await costPlanningApi.updateItem(editingItem.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        category: editForm.category,
        investmentType: editForm.investmentType,
        plannedAmount: Number(editForm.plannedAmount) || 0,
        knownAmount: editForm.knownAmount ? Number(editForm.knownAmount) : undefined,
        currency: editForm.currency,
        dueDate: editForm.dueDate,
        status: editForm.status,
        supplierId: editForm.supplierId,
        supplierName: editForm.supplierId ? undefined : (editForm.supplierName?.trim() || undefined),
        quoteNumber: editForm.quoteNumber || undefined,
        remark: editForm.remark || undefined,
      });
      setEditModalOpen(false);
      setEditingItem(null);
      await ensurePlan();
      setMessage(t('costPlanning.itemUpdated'));
    } catch (error) {
      setMessage(apiErrorMessage(error, t('costPlanning.itemUpdateError')));
    } finally { setEditSaving(false); }
  };

  // Sorting
  const handleSort = (key: keyof CostPlanItem) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key
        ? prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc'
        : 'asc',
    }));
  };

  const getSortIcon = (key: keyof CostPlanItem) => {
    if (sortConfig.key !== key) return <ChevronUpDownIcon className="w-4 h-4 inline ml-1 opacity-40" />;
    if (sortConfig.direction === 'asc') return <ChevronUpIcon className="w-4 h-4 inline ml-1" />;
    if (sortConfig.direction === 'desc') return <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
    return <ChevronUpDownIcon className="w-4 h-4 inline ml-1 opacity-40" />;
  };

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let items = plan?.items ?? [];
    if (filters.search) {
      items = items.filter((item: CostPlanItem) =>
        item.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.displayId?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.supplierName?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    if (filters.status) {
      items = items.filter((item: CostPlanItem) => item.status === filters.status);
    }
    if (filters.category) {
      items = items.filter((item: CostPlanItem) => item.category === filters.category);
    }
    if (filters.supplierName) {
      items = items.filter((item: CostPlanItem) =>
        item.supplierName?.toLowerCase().includes(filters.supplierName.toLowerCase())
      );
    }
    return items;
  }, [plan?.items, filters]);

  const sortedItems = useMemo(() => {
    if (!sortConfig.direction) return filteredItems;
    const items = [...filteredItems];
    items.sort((a: CostPlanItem, b: CostPlanItem) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const comparison = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [filteredItems, sortConfig]);

  const clearFilters = () => {
    setFilters({ search: '', status: '', category: '', supplierName: '' });
    setSortConfig({ key: 'dueDate', direction: null });
  };

  const hasActiveFilters = filters.search || filters.status || filters.category || filters.supplierName;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('costPlanning.title')}</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="fiscal-year-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('costPlanning.fiscalYear')}:</label>
          <select
            id="fiscal-year-select"
            value={fiscalYearLabel}
            onChange={(e) => setFiscalYearLabel(e.target.value)}
            className="rounded-lg border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {years.map((year) => <option key={year.label} value={year.label}>{year.label}</option>)}
          </select>
        </div>
      </div>
      {message && <div role="alert" className="rounded bg-yellow-50 p-3 text-yellow-800">{message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[[t('costPlanning.planned'), summary.plannedAmount], [t('costPlanning.known'), summary.knownAmount], [t('costPlanning.acquired'), summary.acquiredAmount], [t('costPlanning.open'), summary.openAmount]].map(([label, value]) => <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><h3 className="text-sm text-gray-500 dark:text-gray-400">{label}</h3><p className="text-2xl font-bold dark:text-white">{money(value, plan?.currency || 'EUR')}</p></div>)}
      </div>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.yearlyPlanItems')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded flex items-center gap-1 text-sm ${showFilters ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              title={t('costPlanning.filter')}
            >
              <FunnelIcon className="w-4 h-4" />
              {t('costPlanning.filter')}
              {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">{Object.values(filters).filter(Boolean).length}</span>}
            </button>
            <button onClick={exportCsv} className="px-3 py-2 rounded bg-gray-700 text-white flex items-center gap-1" title={t('costPlanning.csvExport')}>
              <DocumentArrowDownIcon className="w-4 h-4" />
              {t('costPlanning.csvExport')}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold dark:text-white">{t('costPlanning.filterTitle')}</h3>
              <button onClick={clearFilters} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                {t('costPlanning.clearAll')}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('costPlanning.search')}</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder={t('costPlanning.searchPlaceholder')}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('costPlanning.status')}</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  <option value="">{t('costPlanning.allStatuses')}</option>
                  <option value="planned">{t('costPlanning.statusPlanned')}</option>
                  <option value="acquired">{t('costPlanning.statusAcquired')}</option>
                  <option value="done">{t('costPlanning.statusDone')}</option>
                  <option value="ordered">{t('costPlanning.statusOrdered')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('costPlanning.category')}</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  <option value="">{t('costPlanning.allCategories')}</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('costPlanning.supplier')}</label>
                <input
                  type="text"
                  value={filters.supplierName}
                  onChange={(e) => setFilters((prev) => ({ ...prev, supplierName: e.target.value }))}
                  placeholder={t('costPlanning.supplierFilterPlaceholder')}
                  className="w-full px-3 py-2 text-sm rounded border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">
                  <button onClick={() => handleSort('displayId')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.item')}{getSortIcon('displayId')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('title')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.titleField')}{getSortIcon('title')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('status')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.status')}{getSortIcon('status')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('category')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.category')}{getSortIcon('category')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('knownAmount')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.amount')}{getSortIcon('knownAmount')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('dueDate')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.due')}{getSortIcon('dueDate')}
                  </button>
                </th>
                <th className="py-2">
                  <button onClick={() => handleSort('supplierName')} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                    {t('costPlanning.supplier')}{getSortIcon('supplierName')}
                  </button>
                </th>
                <th className="py-2">{t('costPlanning.quoteNumber')}</th>
                <th className="py-2">{t('costPlanning.remark')}</th>
                <th className="py-2">{t('costPlanning.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems?.map((item: CostPlanItem) => (
                <tr key={item.id} className="border-t dark:border-gray-700">
                  <td className="py-2 dark:text-white font-medium">{item.displayId}</td>
                  <td className="py-2 dark:text-white">{item.title}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      item.status === 'acquired' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                      item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>{item.status}</span>
                  </td>
                  <td className="py-2 dark:text-white">{item.category}</td>
                  <td className="py-2 dark:text-white">{money(item.knownAmount || item.plannedAmount, item.currency)}</td>
                  <td className="py-2 dark:text-white">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="py-2 dark:text-white">{item.supplierName || '—'}</td>
                  <td className="py-2 dark:text-white">{item.quoteNumber || '—'}</td>
                  <td className="py-2 dark:text-white max-w-xs truncate">{item.remark || '—'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
                        title={t('costPlanning.edit')}
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => markAcquired(item.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600 dark:text-amber-400"
                        title={t('costPlanning.markAcquired')}
                      >
                        <CurrencyDollarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => markDone(item.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600 dark:text-green-400"
                        title={t('costPlanning.done')}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedItems?.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('costPlanning.noItems')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Manual Planned Acquisition */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold dark:text-white mb-3">{t('costPlanning.manualPlannedAcquisition')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input aria-label={t('costPlanning.titleField')} placeholder={t('costPlanning.titleField')} value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          <select aria-label={t('costPlanning.category')} value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white">{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <input aria-label={t('costPlanning.amount')} inputMode="decimal" placeholder={t('costPlanning.amount')} value={manual.plannedAmount} onChange={(e) => setManual({ ...manual, plannedAmount: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          <div className="space-y-1">
            <input aria-label={t('costPlanning.supplierSearch')} list="cost-plan-suppliers" placeholder={t('costPlanning.supplierSearch')} value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setManual((current) => ({ ...current, supplierId: '', supplierName: e.target.value })); }} onBlur={() => { const supplier = suppliers.find((candidate) => candidate.legalName.toLocaleLowerCase() === supplierSearch.trim().toLocaleLowerCase()); if (supplier) setManual((current) => ({ ...current, supplierId: supplier.id, supplierName: supplier.legalName })); }} className="w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
            <datalist id="cost-plan-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.legalName}>{supplier.displayId}</option>)}</datalist>
            {supplierSearch.trim() && !suppliers.some((supplier) => supplier.legalName.toLocaleLowerCase() === supplierSearch.trim().toLocaleLowerCase()) && <button type="button" onClick={createSupplier} disabled={isCreatingSupplier} className="text-sm text-blue-600 disabled:text-gray-400">{isCreatingSupplier ? '…' : `${t('costPlanning.createSupplier')}: ${supplierSearch.trim()}`}</button>}
          </div>
          <input aria-label={t('costPlanning.quoteNumber')} placeholder={t('costPlanning.quoteNumber')} value={manual.quoteNumber} onChange={(e) => setManual({ ...manual, quoteNumber: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          <input aria-label={t('costPlanning.remark')} placeholder={t('costPlanning.remark')} value={manual.remark} onChange={(e) => setManual({ ...manual, remark: e.target.value })} className="rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
        </div>
        <div className="mt-2">
          <button onClick={createManual} disabled={isSubmitting || !plan} className="rounded bg-blue-600 text-white px-4 py-2 disabled:bg-gray-400">{isSubmitting ? '…' : t('costPlanning.add')}</button>
        </div>
      </section>

      {/* Candidates */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold dark:text-white">{t('costPlanning.candidates')}</h2><button onClick={takeover} disabled={selected.length === 0} className="px-3 py-2 rounded bg-blue-600 disabled:bg-gray-300 text-white">{t('costPlanning.takeOverSelected')}</button></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th><input ref={selectAllCandidatesCheckboxRef} type="checkbox" aria-label={t('costPlanning.selectAllCandidates')} aria-checked={isCandidateSelectionIndeterminate ? 'mixed' : allSelectableCandidatesSelected} checked={allSelectableCandidatesSelected} disabled={selectableCandidateKeys.length === 0} onChange={toggleAllVisibleCandidates} /></th><th>{t('costPlanning.source')}</th><th>{t('costPlanning.titleField')}</th><th>{t('costPlanning.reason')}</th><th>{t('costPlanning.amount')}</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.candidateKey} className="border-t dark:border-gray-700"><td><input type="checkbox" disabled={candidate.alreadyInPlan} checked={selected.includes(candidate.candidateKey)} onChange={(e) => toggleCandidate(candidate.candidateKey, e.target.checked)} /></td><td className="py-2 dark:text-white">{candidate.sourceDisplayId} {candidate.sourceLabel}</td><td>{candidate.title}</td><td>{candidate.alreadyInPlan ? t('costPlanning.alreadyInPlan') : candidate.relevanceReason}</td><td>{candidate.plannedAmount ? money(candidate.plannedAmount, candidate.currency) : '—'}</td></tr>)}</tbody></table></div>
      </section>

      {/* Edit Item Modal */}
      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingItem(null); }} title={t('costPlanning.editItem')}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          {editForm.title && (
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
              <span className="text-sm text-gray-500 dark:text-gray-400">{editingItem?.displayId}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.titleField')} *</label>
            <input type="text" value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
            <textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.category')}</label>
              <select value={editForm.category || ''} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.status')}</label>
              <select value={editForm.status || ''} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="planned">{t('costPlanning.statusPlanned')}</option>
                <option value="ordered">{t('costPlanning.statusOrdered')}</option>
                <option value="acquired">{t('costPlanning.statusAcquired')}</option>
                <option value="done">{t('costPlanning.statusDone')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.amount')}</label>
              <input type="number" value={editForm.plannedAmount || ''} onChange={(e) => setEditForm({ ...editForm, plannedAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.knownAmount')}</label>
              <input type="number" value={editForm.knownAmount ?? ''} onChange={(e) => setEditForm({ ...editForm, knownAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.currency')}</label>
              <input type="text" value={editForm.currency || 'EUR'} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.due')}</label>
            <input type="date" value={editForm.dueDate ? new Date(editForm.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, dueDate: new Date(e.target.value).toISOString() })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.quoteNumber')}</label>
            <input type="text" value={editForm.quoteNumber || ''} onChange={(e) => setEditForm({ ...editForm, quoteNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.supplier')}</label>
            <input type="text" value={editSupplierSearch}
              onChange={(e) => handleEditSupplierSearch(e.target.value)}
              placeholder={t('costPlanning.supplierSearch')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {editSuppliers.length > 0 && (
              <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-40 overflow-y-auto">
                {editSuppliers.map((supplier) => (
                  <li key={supplier.id}
                    onClick={() => selectEditSupplier(supplier)}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-sm dark:text-white"
                  >
                    {supplier.legalName} ({supplier.displayId})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('costPlanning.remark')}</label>
            <textarea value={editForm.remark || ''} onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setEditModalOpen(false); setEditingItem(null); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={saveEdit} disabled={editSaving || !editForm.title?.trim()}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {editSaving ? t('common.loading') : t('common.edit')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CostPlanning;
