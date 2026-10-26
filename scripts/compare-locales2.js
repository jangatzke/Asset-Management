// compare-locales2.js - Find dynamic t() template keys and hardcoded UI strings
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');
const localeNames = ['en'];

function flatten(obj, prefix = '', out = {}) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const full = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const locales = {};
for (const name of localeNames) {
  locales[name] = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${name}.json`), 'utf8')));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const srcFiles = walk(SRC_DIR);

// 1. Template literal t() keys: t(`prefix.${expr}` ...) -> verify prefix exists as object namespace
console.log('=== DYNAMIC TEMPLATE KEYS (prefix check) ===');
const dynPattern = /\bt\(\s*`([^`$]*)\$\{/g;
let dynCount = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = dynPattern.exec(content)) !== null) {
    const prefix = m[1];
    if (!prefix) continue;
    // check whether any key in en.json starts with prefix
    const ok = Object.keys(locales.en).some((k) => k.startsWith(prefix));
    if (!ok) {
      console.log('  ' + path.relative(SRC_DIR, file) + ': t(`' + prefix + '${...}`) -> no matching keys for prefix "' + prefix + '"');
      dynCount++;
    }
  }
}
if (dynCount === 0) console.log('(none)');

// 2. Hardcoded strings in JSX props/labels that are NOT inside t()
console.log('\n=== SUSPECTED HARDCODED UI STRINGS (label/title/placeholder=) ===');
const hardPattern = /(?:label|title|placeholder|helperText|emptyText)\s*=\s*(?:"([^"{}]{3,})"|'([^'{]{3,})')/g;
let hardCount = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = hardPattern.exec(content)) !== null) {
    const s = m[1] || m[2];
    // ignore technical values like "email", "password", ids
    if (/^[a-z_]+$/.test(s)) continue;
    console.log(`  ${path.relative(SRC_DIR, file)}: "${s}"`);
    hardCount++;
  }
}
if (hardCount === 0) console.log('(none)');

// 3. JSX text nodes with words (heuristic): >Some Text<
console.log('\n=== SUSPECTED HARDCODED JSX TEXT NODES ===');
const jsxTextPattern = />\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .,&'-]{4,})\s*</g;
let jsxCount = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = jsxTextPattern.exec(content)) !== null) {
    console.log(`  ${path.relative(SRC_DIR, file)}: >${m[1]}<`);
    jsxCount++;
  }
}
if (jsxCount === 0) console.log('(none)');

console.log(`\nSummary: dynamicMissing=${dynCount}, hardcodedProps=${hardCount}, hardcodedJsx=${jsxCount}`);
