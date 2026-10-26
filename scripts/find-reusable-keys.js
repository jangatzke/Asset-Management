// find-reusable-keys.js - Parse hardcoded strings from locale-report2.txt and find matching en.json keys by value
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');

function flatten(obj, prefix = '', out = {}) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const full = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const en = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8')));
const byValue = new Map();
for (const [k, v] of Object.entries(en)) {
  if (typeof v !== 'string') continue;
  const norm = v.trim().toLowerCase();
  if (!byValue.has(norm)) byValue.set(norm, []);
  byValue.get(norm).push(k);
}

const report = fs.readFileSync(path.join(__dirname, '..', 'locale-report2.txt'), 'utf8');
const strings = new Map(); // string -> Set(files)
for (const line of report.split('\n')) {
  let m = line.match(/^\s+((?:pages|components|store)\\[^:]+):\s+"([^"]+)"\s*$/);
  if (m) { if (!strings.has(m[2])) strings.set(m[2], new Set()); strings.get(m[2]).add(m[1]); }
  m = line.match(/^\s+((?:pages|components|store)\\[^:]+):\s+>(.+)<\s*$/);
  if (m) { const s = m[2].trim(); if (!strings.has(s)) strings.set(s, new Set()); strings.get(s).add(m[1]); }
}

const found = [];
const missing = [];
for (const [s, files] of [...strings.entries()].sort()) {
  const hits = byValue.get(s.trim().toLowerCase());
  if (hits && hits.length) found.push({ s, keys: hits, files });
  else missing.push({ s, files });
}

console.log('=== REUSABLE (existing key with same value) ===');
for (const f of found) console.log('FOUND | "' + f.s + '" => ' + f.keys.join(', ') + '  [' + [...f.files].join(', ') + ']');
console.log('\n=== TRULY MISSING (no key with this value) ===');
for (const m2 of missing) console.log('MISS  | "' + m2.s + '"  [' + [...m2.files].join(', ') + ']');
console.log(`\nSummary: reusable=${found.length}, missing=${missing.length}`);
