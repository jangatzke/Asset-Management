const fs = require('fs');
const src = fs.readFileSync('frontend/src/pages/ISMSPhase6.tsx', 'utf8');
const start = src.indexOf('const resourceMetas');
const assign = src.indexOf('=', start);
const end = src.indexOf('const domainGroups');
const block = src.slice(assign + 1, end).trim().replace(/;\s*$/, '');
// object literal is plain JS (unquoted keys, single-quoted strings) -> safe to eval
const metas = eval('(' + block + ')');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const out = { labels: {}, columns: {}, fields: {}, options: {}, placeholders: {} };
for (const meta of Object.values(metas)) {
  out.labels[slug(meta.label)] = meta.label;
  for (const col of meta.columns || []) out.columns[slug(col.label)] = col.label;
  for (const f of meta.fields || []) {
    out.fields[slug(f.label)] = f.label;
    if (f.placeholder) out.placeholders[slug(f.placeholder)] = f.placeholder;
    for (const o of f.options || []) out.options[slug(o.label)] = o.label;
  }
}
fs.writeFileSync('phase6-keys.json', JSON.stringify(out, null, 1));
const unique = new Set();
Object.values(out).forEach((ns) => Object.values(ns).forEach((v) => unique.add(v)));
console.log('namespaces:', Object.entries(out).map(([k, v]) => k + '=' + Object.keys(v).length).join(', '));
console.log('unique strings:', unique.size);
