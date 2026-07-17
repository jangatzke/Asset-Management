import { useState, useEffect } from 'react';
import { controlApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useI18n } from '../context/I18nContext';

interface Control {
  id: string;
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  implementationStatus: string;
  maturityLevel: number;
  applicability: string;
  status: string;
}

interface CreateControlForm {
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  responsibleId: string;
  applicability: string;
  implementationStatus: string;
  maturityLevel: number;
}

const initialForm: CreateControlForm = {
  catalogId: '',
  catalogVersion: '',
  title: '',
  description: '',
  controlGoal: '',
  responsibleId: '',
  applicability: '',
  implementationStatus: 'planned',
  maturityLevel: 0,
};

const Controls = () => {
  const { t } = useI18n();
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateControlForm>(initialForm);

  useEffect(() => {
    loadControls();
  }, []);

  const loadControls = async () => {
    try {
      setLoading(true);
      const response = await controlApi.list({ page: 1, limit: 50 });
      setControls(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredControls = controls.filter((control) =>
    control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'implemented': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'planned': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'under_review': return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const handleCreate = async () => {
    if (!form.catalogId || !form.catalogVersion || !form.title || !form.controlGoal) {
      setError(t('common.requiredField'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await controlApi.create(form);
      setModalOpen(false);
      setForm(initialForm);
      await loadControls();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('controls.createSuccess'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('controls.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('controls.title')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('controls.newControl')}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('controls.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.title')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.controlGoal')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.maturity')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.applicability')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredControls.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('controls.noControls')}
                </td>
              </tr>
            ) : (
              filteredControls.map((control) => (
                <tr key={control.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{control.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{control.controlGoal}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(control.implementationStatus)}`}>
                      {t(`controls.implementationStatus.${control.implementationStatus}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{control.maturityLevel}/5</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{t(`controls.applicability.${control.applicability}`)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('controls.createControl')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.catalogId')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.catalogId}
                onChange={(e) => setForm({ ...form, catalogId: e.target.value })}
                placeholder="e.g., ISO-27001-A.5.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.catalogVersion')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.catalogVersion}
                onChange={(e) => setForm({ ...form, catalogVersion: e.target.value })}
                placeholder="e.g., 2022"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.title')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('controls.fields.title')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('controls.fields.description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.controlGoal')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.controlGoal}
              onChange={(e) => setForm({ ...form, controlGoal: e.target.value })}
              placeholder={t('controls.fields.controlGoal')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.responsibleId')}
              </label>
              <input
                type="text"
                value={form.responsibleId}
                onChange={(e) => setForm({ ...form, responsibleId: e.target.value })}
                placeholder={t('controls.fields.responsibleId')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.applicability')}
              </label>
              <input
                type="text"
                value={form.applicability}
                onChange={(e) => setForm({ ...form, applicability: e.target.value })}
                placeholder={t('controls.fields.applicability')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.implementationStatus')}
              </label>
              <select
                value={form.implementationStatus}
                onChange={(e) => setForm({ ...form, implementationStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">{t('controls.implementationStatus.planned')}</option>
                <option value="in_progress">{t('controls.implementationStatus.in_progress')}</option>
                <option value="implemented">{t('controls.implementationStatus.implemented')}</option>
                <option value="under_review">{t('controls.implementationStatus.under_review')}</option>
                <option value="tested">{t('controls.implementationStatus.tested')}</option>
                <option value="effective">{t('controls.implementationStatus.effective')}</option>
                <option value="not_applicable">{t('controls.implementationStatus.not_applicable')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.maturityLevel')}
              </label>
              <select
                value={form.maturityLevel}
                onChange={(e) => setForm({ ...form, maturityLevel: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 - Not Defined</option>
                <option value={1}>1 - Initial</option>
                <option value={2}>2 - Repeatable</option>
                <option value={3}>3 - Defined</option>
                <option value={4}>4 - Managed</option>
                <option value={5}>5 - Optimized</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.catalogId || !form.catalogVersion || !form.title || !form.controlGoal || saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.loading') : t('controls.createControl')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Controls;
