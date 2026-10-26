// add-locale-keys.js - Deep-merge new keys into all locale JSON files without touching existing values.
// Usage: node scripts/add-locale-keys.js <additions-file.json> [more-additions.json ...]
// The additions file contains nested objects with keys "en", "de", "es", "fr".
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');
const localeNames = ['en', 'de', 'es', 'fr'];

function deepMerge(target, source) {
  let added = 0;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      added += deepMerge(target[key], value);
    } else if (!(key in target)) {
      target[key] = value;
      added++;
    }
  }
  return added;
}

const additionsFiles = process.argv.slice(2);
if (!additionsFiles.length) {
  console.error('Usage: node scripts/add-locale-keys.js <additions.json> ...');
  process.exit(1);
}

for (const file of additionsFiles) {
  const additions = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const name of localeNames) {
    if (!additions[name]) continue;
    const targetPath = path.join(LOCALES_DIR, `${name}.json`);
    const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const added = deepMerge(target, additions[name]);
    fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + '\n');
    console.log(`${name}.json: added ${added} new keys`);
  }
}
