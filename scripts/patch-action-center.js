const fs = require('fs');
const p = 'frontend/src/pages/ActionCenter.tsx';
let src = fs.readFileSync(p, 'utf8');
let missing = 0;

function rep(find, replace) {
  if (!src.includes(find)) { console.log('NOT FOUND:', JSON.stringify(find.slice(0, 70))); missing++; return; }
  src = src.split(find).join(replace);
}

rep("import { ACTION_CENTER_SOURCE_OPTIONS } from './actionCenterHelpers';", "import { ACTION_CENTER_SOURCE_OPTIONS } from './actionCenterHelpers';\nimport { useI18n } from '../context/I18nContext';");
rep("  const [filters, setFilters", "  const { t } = useI18n();\n  const [filters, setFilters");

// CRLF-tolerant multi-line rep
function repLines(lines, replace) {
  const re = new RegExp(lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\r?\\n'), 'g');
  if (!re.test(src)) { console.log('NOT FOUND LINES:', JSON.stringify(lines[0].slice(0, 70))); missing++; return; }
  src = src.replace(re, replace);
}

repLines([
  "    setLoading(true);",
  "    actionCenterApi.list(filters)",
  "      .then(({ data }) => active && setResult(data))",
  "      .catch(() => active && setError('Action Center could not be loaded.'))",
], [
  "    setLoading(true);",
  "    actionCenterApi.list(filters)",
  "      .then(({ data }) => active && setResult(data))",
  "      .catch(() => active && setError(t('actionCenter.loadError')))",
].join('\n'));

rep('<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Action Center</h1>', "<h1 className=\"text-2xl font-bold text-gray-900 dark:text-white\">{t('navigation.actionCenter')}</h1>");
rep('<p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Your open work and due ISMS items you are authorized to view.</p>', "<p className=\"mt-1 text-sm text-gray-600 dark:text-gray-300\">{t('actionCenter.description')}</p>");
rep('>Scope <select', "{t('actionCenter.scopeLabel')} <select");
rep('<option value="all">All available</option><option value="mine">Assigned to me</option><option value="authorized">Authorized items</option>', "<option value=\"all\">{t('actionCenter.allAvailable')}</option><option value=\"mine\">{t('actionCenter.assignedToMe')}</option><option value=\"authorized\">{t('actionCenter.authorizedItems')}</option>");
rep('>Source <select', "{t('actionCenter.sourceLabel')} <select");
rep('<option value="">All sources</option>', "<option value=\"\">{t('actionCenter.allSources')}</option>");
rep('>Due before <input', "{t('actionCenter.dueBeforeLabel')} <input");
rep('<p className="text-gray-600 dark:text-gray-300">Loading actions…</p>', "<p className=\"text-gray-600 dark:text-gray-300\">{t('actionCenter.loading')}</p>");
rep('{entry.sourceType} · {entry.assignment} · Due {new Date(entry.dueDate).toLocaleString()}</div>', "{entry.sourceType} · {entry.assignment} · {t('actionCenter.due', { date: new Date(entry.dueDate).toLocaleString() })}</div>");
rep('hover:underline dark:text-primary-400">Open</Link>', "hover:underline dark:text-primary-400\">{t('actionCenter.open')}</Link>");
rep('<p className="p-6 text-center text-gray-500 dark:text-gray-400">No open items match the selected filters.</p>', "<p className=\"p-6 text-center text-gray-500 dark:text-gray-400\">{t('actionCenter.noMatches')}</p>");
rep('className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>', "className=\"rounded border px-3 py-1 disabled:opacity-50\">{t('common.previous')}</button>");
rep('<span className="py-1 text-sm">Page {result.pagination.page} of {result.pagination.totalPages}</span>', "<span className=\"py-1 text-sm\">{t('pagination.pageOf', { page: result.pagination.page, total: result.pagination.totalPages })}</span>");
rep('className="rounded border px-3 py-1 disabled:opacity-50">Next</button>', "className=\"rounded border px-3 py-1 disabled:opacity-50\">{t('common.next')}</button>");

fs.writeFileSync(p, src);
console.log(missing ? `done with ${missing} missing` : 'done');
process.exit(missing ? 1 : 0);
