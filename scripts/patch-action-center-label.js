const fs = require('fs');
const path = 'frontend/src/pages/ActionCenter.tsx';
let src = fs.readFileSync(path, 'utf8');
const find = 'ACTION_CENTER_SOURCE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{t(`actionCenter.sources.${value}`)}</option>)';
const replace = 'ACTION_CENTER_SOURCE_OPTIONS.map(({ value }) => <option key={value} value={value}>{t(`actionCenter.sources.${value}`)}</option>)';
if (!src.includes(find)) { console.error('NOT FOUND'); process.exit(1); }
src = src.split(find).join(replace);
fs.writeFileSync(path, src);
console.log('removed unused label destructure');
