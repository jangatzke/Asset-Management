const fs = require('fs');
const p = 'src/pages/SupplierDetail.tsx';
let s = fs.readFileSync(p, 'utf8');
const fixes = [
  ["{t('common.type')}<select", "<label>{t('common.type')}<select"],
  ["{t('suppliers.detail.scoreLabel')}<input", "<label>{t('suppliers.detail.scoreLabel')}<input"],
  ["{t('suppliers.detail.ratingLabel')}<select", "<label>{t('suppliers.detail.ratingLabel')}<select"],
];
let n = 0;
for (const [a, b] of fixes) {
  if (!s.includes(a)) { console.log('NOT FOUND:', a); continue; }
  s = s.split(a).join(b);
  n++;
}
fs.writeFileSync(p, s);
console.log('applied', n, 'fixes');
