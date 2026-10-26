const fs = require('fs');
const src = fs.readFileSync('frontend/src/pages/ISMSPhase6.tsx', 'utf8');
// Only inside resourceMetas block (lines between "const resourceMetas" and "const domainGroups")
const start = src.indexOf('const resourceMetas');
const end = src.indexOf('const domainGroups');
const block = src.slice(start, end);
const strings = new Set();
const re = /(?:label|placeholder):\s*'([^']+)'/g;
let m;
while ((m = re.exec(block))) strings.add(m[1]);
// Also option labels appear as label: '...' which the same regex catches.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const out = {};
for (const s of [...strings].sort()) out[slug(s)] = s;
console.log(JSON.stringify(out, null, 1));
