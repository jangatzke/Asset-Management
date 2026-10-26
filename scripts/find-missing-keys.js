const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));

function has(tree, key) {
  return key.split('.').reduce((node, seg) => (node && typeof node === 'object' ? node[seg] : undefined), tree) !== undefined;
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== 'locales') walk(full); }
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.test.ts')) files.push(full);
  }
}
walk('frontend/src');

const missing = new Set();
const dynamic = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // static keys: t('...') or t("...")
  const reStatic = /\bt\(\s*'([a-zA-Z0-9_.]+)'/g;
  let m;
  while ((m = reStatic.exec(src))) if (!has(en, m[1])) missing.add(m[1] + '  <- ' + file);
  // template keys: t(`...${...}...`)
  const reTpl = /\bt\(\s*`([^`]+)`/g;
  while ((m = reTpl.exec(src))) if (m[1].includes('${')) dynamic.add(m[1] + '  <- ' + file);
}

console.log('=== STATIC MISSING (' + missing.size + ') ===');
[...missing].sort().forEach((k) => console.log(k));
console.log('=== DYNAMIC (' + dynamic.size + ') ===');
[...dynamic].sort().forEach((k) => console.log(k));
