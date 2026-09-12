const fs = require('fs');
const path = process.argv[2] || 'frontend/src/locales/en.json';
const s = fs.readFileSync(path, 'utf8');
const l = s.split('\n');
l.forEach((x, i) => {
  const k = i + 1;
  const t = x.trim();
  if (t.match(/removeFilter|clearAll|filters|navigation|clearView/) && t.match(/:.*\{?\s*$/)) {
    console.log(k + ': ' + t);
  }
});
