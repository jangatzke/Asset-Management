import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetApi } from '../services/api';
import AssetGraph from '../components/AssetGraph';

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
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<AssetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const response = await assetApi.getById(assetId);
      setAsset(response.data);
      setError(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error?.message ?? requestError?.message ?? 'Asset not found.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 text-gray-500">Loading asset…</div>;
  if (!asset) return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><Link to="/assets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← Assets</Link><p role="alert" className="mt-4 text-red-700">{error}</p></div>;

  const graphFallbackNode = { id: asset.id, name: asset.name, displayId: asset.displayId, type: asset.assetType?.name, criticality: asset.criticality };

  return <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
    <Link to="/assets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← Assets</Link>
    <header className="mt-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{asset.displayId} · {asset.name}</h1>
      <p className="mt-2 text-sm text-gray-500">{asset.assetType?.name} · {(asset.assetSubtype as any)?.name} · {asset.criticality} criticality · {asset.lifecycleStatus}</p>
      {asset.description && <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">{asset.description}</p>}
    </header>
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-bold">Details</h2>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-gray-500">Inventory number</dt><dd className="font-semibold">{asset.inventoryNumber || '—'}</dd></div>
        <div><dt className="text-gray-500">Manufacturer</dt><dd>{asset.manufacturer || '—'}</dd></div>
        <div><dt className="text-gray-500">Model</dt><dd>{asset.model || '—'}</dd></div>
        <div><dt className="text-gray-500">Serial number</dt><dd>{asset.serialNumber || '—'}</dd></div>
        <div><dt className="text-gray-500">Status</dt><dd>{asset.status || '—'}</dd></div>
        <div><dt className="text-gray-500">Organization unit</dt><dd>{asset.organizationUnit?.name || '—'}</dd></div>
      </dl>
    </section>
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-bold">Relationships</h2>
      <AssetGraph assetId={asset.id} fallbackNode={graphFallbackNode} focusAssetId={asset.id} heightClassName="h-[40rem]" height="640px" />
    </section>
  </main>;
};

export default AssetDetail;
