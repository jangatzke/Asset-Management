import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetApi } from '../services/api';
import AssetGraph from '../components/AssetGraph';
import DetailTabs from '../components/DetailTabs';
import { useI18n } from '../context/I18nContext';
import { formatApiError } from '../utils/apiError';
import PageShell from '../components/PageShell';
import { PageBreadcrumbs } from '../components/PageHeader';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

interface AssetDetailData {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  criticality?: string;
  lifecycleStatus?: string;
  status?: string;
  inventoryNumber?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  assetType?: { name: string } | null;
  assetSubtype?: { name: string } | null;
  organizationUnit?: { name: string } | null;
  [key: string]: unknown;
}

const AssetDetail = () => {
  const { t } = useI18n();
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<AssetDetailData | null>(null);
  // Detail leaf label comes from already-loaded page state (no extra fetch).
  const breadcrumbs = useBreadcrumbs({ leaf: asset?.name ? `${asset.displayId} · ${asset.name}` : null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const response = await assetApi.getById(assetId);
      setAsset(response.data);
      setError(null);
    } catch (requestError: unknown) {
      setError(formatApiError(requestError, t('assets.detail.notFound'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is only the error-message fallback; adding it would refetch the asset on language switch.
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageShell><span className="text-text-muted">{t('assets.detail.loading')}</span></PageShell>;
  if (!asset) return <PageShell><Link to="/assets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← {t('navigation.assets')}</Link><p role="alert" className="mt-4 text-red-700">{error}</p></PageShell>;

  const graphFallbackNode = { id: asset.id, name: asset.name, displayId: asset.displayId, type: asset.assetType?.name, criticality: asset.criticality };

  // Stage 10c / LT-5: the two existing sections (details, relationships) are
  // grouped into DetailTabs — content and fetch lifecycle are unchanged. The
  // page has no history section, so none is invented here.
  return <PageShell>
    <PageBreadcrumbs items={breadcrumbs} />
    <Link to="/assets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← {t('navigation.assets')}</Link>
    <header className="mt-4 rounded-lg bg-surface-default p-card-pad shadow-e1">
      <h1 className="text-h2 text-text-primary">{asset.displayId} · {asset.name}</h1>
      <p className="mt-2 text-body2 text-text-muted">{asset.assetType?.name} · {(asset.assetSubtype as any)?.name} · {asset.criticality} criticality · {asset.lifecycleStatus}</p>
      {asset.description && <p className="mt-3 text-body2 text-text-secondary">{asset.description}</p>}
    </header>
    <DetailTabs
      className="mt-section-gap"
      ariaLabel={t('assets.detail.detailsHeading')}
      syncUrlParam
      tabs={[
        {
          id: 'details',
          label: t('assets.detail.detailsHeading'),
          content: (
            <section className="rounded-lg bg-surface-default p-card-pad shadow-e1">
              <h2 className="mb-4 text-h3 text-text-primary">{t('assets.detail.detailsHeading')}</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-text-muted">{t('assets.fields.inventoryNumber')}</dt><dd className="font-semibold">{asset.inventoryNumber || '—'}</dd></div>
                <div><dt className="text-text-muted">{t('assets.fields.manufacturer')}</dt><dd>{asset.manufacturer || '—'}</dd></div>
                <div><dt className="text-text-muted">{t('assets.fields.model')}</dt><dd>{asset.model || '—'}</dd></div>
                <div><dt className="text-text-muted">{t('assets.fields.serialNumber')}</dt><dd>{asset.serialNumber || '—'}</dd></div>
                <div><dt className="text-text-muted">{t('common.status')}</dt><dd>{asset.status || '—'}</dd></div>
                <div><dt className="text-text-muted">{t('assets.organizationUnit')}</dt><dd>{asset.organizationUnit?.name || '—'}</dd></div>
              </dl>
            </section>
          ),
        },
        {
          id: 'relationships',
          label: t('assets.detail.relationshipsHeading'),
          content: (
            <section className="rounded-lg bg-surface-default p-card-pad shadow-e1">
              <h2 className="mb-4 text-h3 text-text-primary">{t('assets.detail.relationshipsHeading')}</h2>
              <AssetGraph assetId={asset.id} fallbackNode={graphFallbackNode} focusAssetId={asset.id} heightClassName="h-[40rem]" height="640px" />
            </section>
          ),
        },
      ]}
    />
  </PageShell>;
};

export default AssetDetail;
