import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuthStore } from '../store/auth';
import { knowledgeApi, type KnowledgeArticleCategory, type KnowledgeArticleDetail, type KnowledgeArticleInput, type KnowledgeArticleSummary } from '../services/api';
import { extractApiError } from '../utils/apiError';

const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const CATEGORIES: KnowledgeArticleCategory[] = ['general', 'incident', 'risk', 'control', 'supplier', 'nis2', 'service'];
const STATUSES = ['draft', 'published'] as const;

export default function KnowledgeBase() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  // Mirrors the Layout fallback: sessions without a permission list keep the UI open.
  const canWrite = !user?.permissions ? true : user.permissions.includes('documents.write');

  const [articles, setArticles] = useState<KnowledgeArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Seed from ?search= so the global search "show all" deep-link works.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const [detail, setDetail] = useState<KnowledgeArticleDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeArticleDetail | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<KnowledgeArticleCategory>('general');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.list({
        search: search.trim() || undefined,
        category: category || undefined,
        status: status || undefined,
      });
      setArticles(res.data);
    } catch (caught) {
      setError(extractApiError(caught, t('knowledge.loadError')).message);
    } finally {
      setLoading(false);
    }
  }, [search, category, status, t]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    setError('');
    try {
      const res = await knowledgeApi.getById(id);
      setDetail(res.data);
    } catch (caught) {
      setError(extractApiError(caught, t('knowledge.loadError')).message);
    }
  };

  const startCreate = () => {
    setEditing(null);
    setFormTitle('');
    setFormSummary('');
    setFormContent('');
    setFormCategory('general');
    setFormTags('');
    setFormStatus('draft');
    setFormOpen(true);
  };

  const startEdit = async (id: string) => {
    try {
      const res = await knowledgeApi.getById(id);
      setEditing(res.data);
      setFormTitle(res.data.title);
      setFormSummary(res.data.summary ?? '');
      setFormContent(res.data.content);
      setFormCategory(res.data.category);
      setFormTags(res.data.tags.join(', '));
      setFormStatus(res.data.status === 'published' ? 'published' : 'draft');
      setDetail(null);
      setFormOpen(true);
    } catch (caught) {
      setError(extractApiError(caught, t('knowledge.loadError')).message);
    }
  };

  const saveArticle = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const tags = formTags.split(',').map((tag) => tag.trim()).filter(Boolean);
      const payload: KnowledgeArticleInput = {
        title: formTitle,
        summary: formSummary || undefined,
        content: formContent,
        category: formCategory,
        tags,
        status: formStatus,
      };
      if (editing) {
        await knowledgeApi.update(editing.id, payload);
      } else {
        await knowledgeApi.create(payload);
      }
      setMessage(t('knowledge.saved'));
      setFormOpen(false);
      await load();
    } catch (caught) {
      setError(extractApiError(caught, t('knowledge.saveError')).message);
    } finally {
      setSaving(false);
    }
  };

  const archiveArticle = async (id: string) => {
    setError('');
    try {
      await knowledgeApi.delete(id);
      setMessage(t('knowledge.archived'));
      setDetail(null);
      await load();
    } catch (caught) {
      setError(extractApiError(caught, t('common.deleteError')).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('knowledge.title')}</h1>
        {canWrite && (
          <button onClick={startCreate} className="rounded bg-primary-600 px-4 py-2 text-white">
            {t('knowledge.newArticle')}
          </button>
        )}
      </header>

      {error && <div className="rounded bg-red-100 p-3 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
      {message && <div className="rounded bg-green-100 p-3 text-green-800 dark:bg-green-900 dark:text-green-200">{message}</div>}

      <section className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm font-medium">
            {t('common.search')}
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('knowledge.searchPlaceholder')} className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t('knowledge.fields.category')}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} min-w-40`}>
              <option value="">{t('common.all')}</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>{t(`knowledge.categories.${value}`)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {t('common.status')}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} min-w-32`}>
              <option value="">{t('common.allStatuses')}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{t(`knowledge.statuses.${value}`)}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-gray-500">{t('common.loading')}</p>
        ) : articles.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t('knowledge.empty')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {articles.map((article) => (
              <li key={article.id} className="rounded border p-4 dark:border-gray-600">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-400">{article.displayId} · {t(`knowledge.categories.${article.category}`)}</span>
                    <button onClick={() => void openDetail(article.id)} className="block truncate text-left font-medium text-primary-700 hover:underline dark:text-primary-300">
                      {article.title}
                    </button>
                    {article.summary && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{article.summary}</p>}
                    {article.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.tags.map((tag) => (
                          <span key={tag} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {article.status !== 'published' && (
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t(`knowledge.statuses.${article.status}`)}</span>
                    )}
                    <span className="text-xs text-gray-400">{t('knowledge.viewCount', { count: article.viewCount })}</span>
                    {canWrite && (
                      <div className="flex gap-2">
                        <button onClick={() => void startEdit(article.id)} className="rounded border px-3 py-1 text-sm">{t('common.edit')}</button>
                        <button onClick={() => void archiveArticle(article.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-600">{t('common.delete')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Read view overlay (counts a view per open) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className={`${card} max-h-full w-full max-w-2xl overflow-y-auto`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs text-gray-400">{detail.displayId} · {t(`knowledge.categories.${detail.category}`)}</span>
                <h2 className="text-lg font-semibold">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="rounded border px-3 py-1 text-sm">{t('common.close')}</button>
            </div>
            {detail.summary && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{detail.summary}</p>}
            <pre className="mt-4 whitespace-pre-wrap break-words text-sm">{detail.content}</pre>
            {detail.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {detail.tags.map((tag) => (
                  <span key={tag} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{tag}</span>
                ))}
              </div>
            )}
            {canWrite && (
              <div className="mt-4 flex gap-2 border-t pt-4 dark:border-gray-700">
                <button onClick={() => void startEdit(detail.id)} className="rounded bg-primary-600 px-4 py-2 text-white">{t('common.edit')}</button>
                <button onClick={() => void archiveArticle(detail.id)} className="rounded border border-red-300 px-4 py-2 text-red-600">{t('common.delete')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / edit form overlay */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={saveArticle} className={`${card} max-h-full w-full max-w-2xl overflow-y-auto`}>
            <h2 className="text-lg font-semibold">{editing ? t('knowledge.editArticle') : t('knowledge.newArticle')}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                {t('common.title')} *
                <input required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} maxLength={250} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {t('knowledge.fields.summary')}
                <textarea value={formSummary} onChange={(e) => setFormSummary(e.target.value)} rows={2} maxLength={500} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {t('knowledge.fields.content')} *
                <textarea required value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={10} className={input} />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-medium">
                  {t('knowledge.fields.category')}
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as KnowledgeArticleCategory)} className={input}>
                    {CATEGORIES.map((value) => (
                      <option key={value} value={value}>{t(`knowledge.categories.${value}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {t('common.status')}
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')} className={input}>
                    {STATUSES.map((value) => (
                      <option key={value} value={value}>{t(`knowledge.statuses.${value}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {t('knowledge.fields.tags')}
                  <input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder={t('knowledge.tagsPlaceholder')} className={input} />
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('common.save')}</button>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded border px-4 py-2">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
