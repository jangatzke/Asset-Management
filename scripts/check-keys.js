// check-keys.js — report which of a hardcoded key list are missing from en.json
const fs = require('fs');
const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));
const keys = [
  'groups.assignUsers', 'entityPicker.searchPlaceholder', 'common.filters', 'common.clearAll',
  'entities.assets', 'tickets.filterTitle', 'tickets.detail.assignee', 'tickets.detail.attachAsset',
  'tickets.detail.linkRisk', 'ismsProcess.clause5.owner', 'ismsProcess.clause7.assignee',
  'incidents.fields.incidentManagerId', 'incidents.fields.affectedAssets', 'incidents.fields.affectedProcesses',
  'nis2.organizationUnit', 'risks.assessor', 'operationsWorkspace.form.responsibleUser',
  'operationsWorkspace.form.selectOption', 'suppliers.detail.selectContract', 'suppliers.detail.selectRisk',
  'bcm.detail.participants', 'incidents.detail.approvingUser', 'common.next', 'common.edit', 'common.add',
  'actionCenter.title', 'suppliers.criticality', 'suppliers.nextReviewDate', 'common.description'
];
for (const k of keys) {
  let node = en;
  for (const seg of k.split('.')) {
    if (node && typeof node === 'object' && seg in node) node = node[seg];
    else { node = undefined; break; }
  }
  if (node === undefined) console.log('MISSING ' + k);
}
console.log('done');
