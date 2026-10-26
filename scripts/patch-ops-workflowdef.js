const fs = require('fs');
const p = 'frontend/src/pages/OperationsWorkspace.tsx';
let s = fs.readFileSync(p, 'utf8');
const f = "choose(workflows, 'Workflow definition')";
if (!s.includes(f)) { console.log('NOT FOUND'); process.exit(1); }
s = s.split(f).join("choose(workflows, t('operationsWorkspace.form.workflowDefinition'))");
fs.writeFileSync(p, s);
console.log('done');
