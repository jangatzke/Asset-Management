const fs = require('fs');
const p = 'frontend/src/pages/AssetDetail.tsx';
let src = fs.readFileSync(p, 'utf8');
let missing = 0;

function rep(find, replace) {
  if (!src.includes(find)) { console.log('NOT FOUND:', JSON.stringify(find.slice(0, 70))); missing++; return; }
  src = src.split(find).join(replace);
}

// Add useI18n import and hook
rep("import AssetGraph from '../components/AssetGraph';", "import AssetGraph from '../components/AssetGraph';\nimport { useI18n } from '../context/I18nContext';");
rep("  const { assetId } = useParams<{ assetId: string }>();", "  const { t } = useI18n();\n  const { assetId } = useParams<{ assetId: string }>();");

rep("?? requestError?.message ?? 'Asset not found.'", "?? requestError?.message ?? t('assets.detail.notFound')");
rep('text-gray-500">Loading asset…</div>', "text-gray-500\">{t('assets.detail.loading')}</div>");
rep('dark:text-primary-300">← Assets</Link>', "dark:text-primary-300\">← {t('navigation.assets')}</Link>");
rep('<h2 className="mb-4 text-lg font-bold">Details</h2>', "<h2 className=\"mb-4 text-lg font-bold\">{t('assets.detail.detailsHeading')}</h2>");
rep('<dt className="text-gray-500">Inventory number</dt>', "<dt className=\"text-gray-500\">{t('assets.fields.inventoryNumber')}</dt>");
rep('<dt className="text-gray-500">Manufacturer</dt>', "<dt className=\"text-gray-500\">{t('assets.fields.manufacturer')}</dt>");
rep('<dt className="text-gray-500">Model</dt>', "<dt className=\"text-gray-500\">{t('assets.fields.model')}</dt>");
rep('<dt className="text-gray-500">Serial number</dt>', "<dt className=\"text-gray-500\">{t('assets.fields.serialNumber')}</dt>");
rep('<dt className="text-gray-500">Status</dt>', "<dt className=\"text-gray-500\">{t('common.status')}</dt>");
rep('<dt className="text-gray-500">Organization unit</dt>', "<dt className=\"text-gray-500\">{t('assets.organizationUnit')}</dt>");
rep('<h2 className="mb-4 text-lg font-bold">Relationships</h2>', "<h2 className=\"mb-4 text-lg font-bold\">{t('assets.detail.relationshipsHeading')}</h2>");

fs.writeFileSync(p, src);
console.log(missing ? `done with ${missing} missing` : 'done');
process.exit(missing ? 1 : 0);
