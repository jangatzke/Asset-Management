const fs = require('fs');
const path = 'frontend/src/pages/ActionCenter.tsx';
let src = fs.readFileSync(path, 'utf8');

function rep(find, replace) {
  if (!src.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 60)); process.exitCode = 1; return; }
  src = src.split(find).join(replace);
}

// restore missing '>' after label className (broken JSX from previous patch)
rep('dark:text-gray-200"{t(\'actionCenter.scopeLabel\')}', 'dark:text-gray-200">{t(\'actionCenter.scopeLabel\')}');
rep('dark:text-gray-200"{t(\'actionCenter.sourceLabel\')}', 'dark:text-gray-200">{t(\'actionCenter.sourceLabel\')}');
rep('dark:text-gray-200"{t(\'actionCenter.dueBeforeLabel\')}', 'dark:text-gray-200">{t(\'actionCenter.dueBeforeLabel\')}');

// translate urgency summary buttons and badges at render time
rep('<div className="text-sm capitalize">{urgency}</div>', '<div className="text-sm capitalize">{t(`actionCenter.urgency.${urgency}`)}</div>');
rep('{entry.urgency}</span>', '{t(`actionCenter.urgency.${entry.urgency}`)}</span>');

// translate source option labels at render time (helper constants stay untouched for the test)
rep('<option key={value} value={value}>{label}</option>', '<option key={value} value={value}>{t(`actionCenter.sources.${value}`)}</option>');
rep('{entry.sourceType} \u00b7 ', '{t(`actionCenter.sources.${entry.sourceType}`)} \u00b7 ');

fs.writeFileSync(path, src);
console.log('patched ActionCenter.tsx');
