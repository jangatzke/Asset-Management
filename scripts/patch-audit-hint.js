const fs = require('fs');
const p = 'frontend/src/pages/AuditWorkspace.tsx';
let s = fs.readFileSync(p, 'utf8');
const find = '<p className="text-sm text-gray-500">Program \u2192 audit \u2192 {t(\'audit.findings\').toLowerCase()} \u2192 {t(\'audit.evidence\').toLowerCase()} \u2192 CAPA \u2192 effectiveness \u2192 close/reopen</p>';
if (!s.includes(find)) { console.error('NOT FOUND'); process.exit(1); }
s = s.split(find).join('<p className="text-sm text-gray-500">{t(\'audit.workflowHint\')}</p>');
fs.writeFileSync(p, s);
console.log('done');
