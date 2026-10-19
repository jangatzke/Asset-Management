import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { serviceCatalogApi, ticketApi, type ServiceCatalogItem, type ServiceCatalogItemInput } from '../services/api';
import { extractApiError } from '../utils/apiError';

const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

export default function ServiceCatalog() {
  const { t } = useI18n();
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Order wizard state
  const [orderItem, setOrderItem] = useState<ServiceCatalogItem | null>(null);
  const [orderTitle, setOrderTitle] = useState('');
  const [orderDescription, setOrderDescription] = useState('');
  const [orderUrgency, setOrderUrgency] = useState('medium');
  const [orderSaving, setOrderSaving] = useState(false);

  // Admin CRUD state
  const [adminMode, setAdminMode] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTicketType, setFormTicketType] = useState<'service_request' | 'problem' | 'change'>('service_request');
  const [formSlaHours, setFormSlaHours] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = adminMode ? await serviceCatalogApi.listAll() : await serviceCatalogApi.list();
      setItems(res.data);
    } catch (caught) {
      setError(extractApiError(caught, t('serviceCatalog.loadError')).message);
    } finally {
      setLoading(false);
    }
  }, [adminMode, t]);

  useEffect(() => { void load(); }, [load]);

  // --- Order wizard ---
  const openOrder = (item: ServiceCatalogItem) => {
    setOrderItem(item);
    setOrderTitle(`${item.name}`);
    setOrderDescription(item.description ?? '');
    setOrderUrgency('medium');
    setError('');
    setMessage('');
  };

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderItem) return;
    setOrderSaving(true);
    setError('');
    try {
      await ticketApi.create({
        type: orderItem.ticketType,
        title: orderTitle,
        description: orderDescription || undefined,
        urgency: orderUrgency,
        impact: 'medium',
        // The catalog link is only valid for service_request tickets; the backend
        // rejects a serviceRequest extension on other ticket types.
        ...(orderItem.ticketType === 'service_request' ? { serviceRequest: { catalogItemId: orderItem.id } } : {}),
      });
      setMessage(t('serviceCatalog.orderCreated'));
      setOrderItem(null);
    } catch (caught) {
      setError(extractApiError(caught, t('serviceCatalog.orderError')).message);
    } finally {
      setOrderSaving(false);
    }
  };

  // --- Admin CRUD ---
  const startCreate = () => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormTicketType('service_request');
    setFormSlaHours('');
    setFormEnabled(true);
  };

  const startEdit = (item: ServiceCatalogItem) => {
    setEditingItem(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormDescription(item.description ?? '');
    setFormTicketType(item.ticketType);
    setFormSlaHours(String(item.fulfillment?.slaHours ?? ''));
    setFormEnabled(item.enabled);
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: ServiceCatalogItemInput = {
        code: formCode,
        name: formName,
        description: formDescription || undefined,
        ticketType: formTicketType,
        fulfillment: formSlaHours ? { slaHours: Number(formSlaHours) } : undefined,
        enabled: formEnabled,
      };
      if (editingItem) {
        await serviceCatalogApi.update(editingItem.id, payload);
      } else {
        await serviceCatalogApi.create(payload);
      }
      setMessage(t('serviceCatalog.itemSaved'));
      startCreate();
      await load();
    } catch (caught) {
      setError(extractApiError(caught, t('serviceCatalog.saveError')).message);
    } finally {
      setSaving(false);
    }
  };

  const disableItem = async (id: string) => {
    try {
      await serviceCatalogApi.disable(id);
      setMessage(t('serviceCatalog.itemDisabled'));
      await load();
    } catch (caught) {
      setError(extractApiError(caught, t('serviceCatalog.saveError')).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('serviceCatalog.title')}</h1>
        <button
          onClick={() => setAdminMode((v) => !v)}
          className="rounded border px-3 py-1 text-sm"
        >
          {adminMode ? t('serviceCatalog.browseMode') : t('serviceCatalog.adminMode')}
        </button>
      </header>

      {error && <div className="rounded bg-red-100 p-3 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
      {message && <div className="rounded bg-green-100 p-3 text-green-800 dark:bg-green-900 dark:text-green-200">{message}</div>}

      {/* Order wizard modal */}
      {orderItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitOrder} className={`${card} w-full max-w-lg`}>
            <h2 className="text-lg font-semibold">{t('serviceCatalog.orderTitle')}</h2>
            <p className="mt-1 text-sm text-gray-500">{orderItem.code} — {orderItem.name}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                {t('common.title')} *
                <input required value={orderTitle} onChange={(e) => setOrderTitle(e.target.value)} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {t('common.description')}
                <textarea value={orderDescription} onChange={(e) => setOrderDescription(e.target.value)} rows={4} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {t('serviceCatalog.urgency')}
                <select value={orderUrgency} onChange={(e) => setOrderUrgency(e.target.value)} className={input}>
                  {['low', 'medium', 'high', 'critical'].map((v) => (
                    <option key={v} value={v}>{t(`tickets.priorities.${v}`)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={orderSaving} className="rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">
                {t('serviceCatalog.submitOrder')}
              </button>
              <button type="button" onClick={() => setOrderItem(null)} className="rounded border px-4 py-2">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog listing */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{adminMode ? t('serviceCatalog.manageItems') : t('serviceCatalog.availableServices')}</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t('serviceCatalog.noItems')}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-4 dark:border-gray-600">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-gray-400">{item.code}</span>
                    <h3 className="font-medium">{item.name}</h3>
                    {item.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>}
                  </div>
                  {!item.enabled && <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">{t('serviceCatalog.disabled')}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  {item.enabled && !adminMode && (
                    <button onClick={() => openOrder(item)} className="rounded bg-primary-600 px-3 py-1 text-sm text-white">
                      {t('serviceCatalog.order')}
                    </button>
                  )}
                  {adminMode && (
                    <>
                      <button onClick={() => startEdit(item)} className="rounded border px-3 py-1 text-sm">{t('common.edit')}</button>
                      {item.enabled && <button onClick={() => void disableItem(item.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-600">{t('serviceCatalog.disable')}</button>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin CRUD form */}
      {adminMode && (
        <section className={card}>
          <h2 className="text-lg font-semibold">{editingItem ? t('serviceCatalog.editItem') : t('serviceCatalog.createItem')}</h2>
          <form onSubmit={saveItem} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              {t('serviceCatalog.code')} *
              <input required value={formCode} onChange={(e) => setFormCode(e.target.value)} disabled={!!editingItem} className={`${input} disabled:opacity-50`} />
            </label>
            <label className="block text-sm font-medium">
              {t('serviceCatalog.name')} *
              <input required value={formName} onChange={(e) => setFormName(e.target.value)} className={input} />
            </label>
            <label className="block text-sm font-medium md:col-span-2">
              {t('common.description')}
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className={input} />
            </label>
            <label className="block text-sm font-medium">
              {t('serviceCatalog.ticketType')}
              <select value={formTicketType} onChange={(e) => setFormTicketType(e.target.value as any)} className={input}>
                <option value="service_request">{t('tickets.types.service_request')}</option>
                <option value="problem">{t('tickets.types.problem')}</option>
                <option value="change">{t('tickets.types.change')}</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              {t('serviceCatalog.slaHours')}
              <input type="number" min={0} value={formSlaHours} onChange={(e) => setFormSlaHours(e.target.value)} className={input} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
              {t('serviceCatalog.enabled')}
            </label>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" disabled={saving} className="rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('common.save')}</button>
              {editingItem && <button type="button" onClick={startCreate} className="rounded border px-4 py-2">{t('serviceCatalog.newItem')}</button>}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
