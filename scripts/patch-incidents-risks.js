const fs = require('fs');

function patch(p, pairs) {
  let s = fs.readFileSync(p, 'utf8');
  for (const [find, replace] of pairs) {
    if (!s.includes(find)) { console.error('NOT FOUND in ' + p + ': ' + find.slice(0, 70)); process.exitCode = 1; continue; }
    s = s.split(find).join(replace);
  }
  fs.writeFileSync(p, s);
}

patch('frontend/src/pages/Incidents.tsx', [
  ['aria-label="Incident status filter"', "aria-label={t('incidents.statusFilterAria')}"],
  ['<SortableTh column="nis2" label="NIS-2"', "<SortableTh column=\"nis2\" label={t('incidents.columns.nis2')}"],
  ['labelKey="incidents.fields.affectedAssets"\n              label="Affected assets"', 'labelKey="incidents.fields.affectedAssets"'],
  ['labelKey="incidents.fields.affectedProcesses"\n              label="Affected processes"', 'labelKey="incidents.fields.affectedProcesses"'],
  ['aria-label="Filter by action"', "aria-label={t('incidents.history.filterByAction')}"],
]);

patch('frontend/src/pages/Risks.tsx', [
  ['aria-label="Risk status filter"', "aria-label={t('risks.statusFilterAria')}"],
]);

console.log('done');
