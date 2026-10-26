// compare-locales.js - Find missing translation keys across locales and in source usage
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');
const localeNames = ['en', 'de', 'es', 'fr'];

function flatten(obj, prefix = '', out = {}) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const full = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out[full] = value;
    }
  }
  return out;
}

const locales = {};
for (const name of localeNames) {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, `${name}.json`), 'utf8');
  locales[name] = flatten(JSON.parse(raw));
}

// 1. Cross-locale key comparison
const allKeys = new Set();
for (const name of localeNames) Object.keys(locales[name]).forEach((k) => allKeys.add(k));

console.log('=== CROSS-LOCALE MISSING KEYS ===');
let crossMissingCount = 0;
for (const name of localeNames) {
  const missing = [...allKeys].filter((k) => !(k in locales[name]));
  if (missing.length) {
    console.log(`\n[${name}] missing ${missing.length} keys:`);
    missing.forEach((k) => console.log('  ' + k));
    crossMissingCount += missing.length;
  }
}
if (crossMissingCount === 0) console.log('(none)');

// Empty values check
console.log('\n=== EMPTY/INVALID VALUES ===');
let emptyCount = 0;
for (const name of localeNames) {
  for (const [k, v] of Object.entries(locales[name])) {
    if (typeof v !== 'string' || v.trim() === '' || v === k) {
      console.log(`[${name}] ${k} => ${JSON.stringify(v)}`);
      emptyCount++;
    }
  }
}
if (emptyCount === 0) console.log('(none)');

// 2. Scan source for used keys
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const usedKeys = new Map(); // key -> Set of files
const patterns = [
  /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
  /\bi18n\.t\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
];

const srcFiles = walk(SRC_DIR);
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const key = m[1];
      if (!key.includes('.')) continue; // skip non-namespaced literals
      if (!usedKeys.has(key)) usedKeys.set(key, new Set());
      usedKeys.get(key).add(path.relative(SRC_DIR, file));
    }
  }
}

console.log('\n=== USED KEYS MISSING IN en.json ===');
let missingUsed = 0;
for (const [key, files] of [...usedKeys.entries()].sort()) {
  if (!(key in locales.en)) {
    console.log(`  ${key}  <- ${[...files].join(', ')}`);
    missingUsed++;
  }
}
if (missingUsed === 0) console.log('(none)');

console.log('\n=== USED KEYS MISSING IN OTHER LOCALES (but present in en) ===');
let missingOther = 0;
for (const [key, files] of [...usedKeys.entries()].sort()) {
  const missIn = localeNames.filter((n) => n !== 'en' && !(key in locales[n]));
  if (missIn.length) {
    console.log(`  ${key} missing in: ${missIn.join(',')}  <- ${[...files].join(', ')}`);
    missingOther++;
  }
}
if (missingOther === 0) console.log('(none)');

console.log(`\nSummary: crossLocaleMissing=${crossMissingCount}, emptyValues=${emptyCount}, usedMissingInEn=${missingUsed}, usedMissingInOthers=${missingOther}`);
