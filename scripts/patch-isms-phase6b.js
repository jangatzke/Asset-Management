const fs = require('fs');
const p = 'frontend/src/pages/AuditWorkspace.tsx'; // placeholder, overwritten below
const target = 'frontend/src/pages/ISMSPhase6.tsx';
let s = fs.readFileSync(target, 'utf8');

// CRLF-tolerant replace: find is a literal string; \n in it matches \r?\n
function rep(find, replace) {
  const pattern = find.split('\n').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\r?\\n');
  const re = new RegExp(pattern, 'g');
  if (!re.test(s)) { console.error('NOT FOUND: ' + find.slice(0, 90)); process.exitCode = 1; return; }
  re.lastIndex = 0;
  s = s.replace(re, replace.replace(/\$/g, '$$$$'));
}

// Banner (avoid em dash in search by regex between markers)
{
  const re = /<h2 className="font-semibold text-blue-950 dark:text-primary-100">Guided operational workflows<\/h2><p className="text-sm text-primary-800 dark:text-primary-200">[\s\S]*?<\/p>/;
  if (!re.test(s)) { console.error('NOT FOUND banner'); process.exitCode = 1; } else {
    s = s.replace(re, '<h2 className="font-semibold text-blue-950 dark:text-primary-100">{t(\'ismsPhase6.guidedTitle\')}</h2><p className="text-sm text-primary-800 dark:text-primary-200">{t(\'ismsPhase6.guidedText\')}</p>');
  }
}

// Resource buttons (single line now)
rep('{m.label}', "{t(`ismsPhase6.labels.${phase6Slug(m.label)}`)}");

// Status filter options + form select options (both occurrences)
rep('<option key={o.value} value={o.value}>{o.label}</option>', "<option key={o.value} value={o.value}>{t(`ismsPhase6.options.${phase6Slug(o.label)}`)}</option>");

// Table cells boolean-aware
rep('formatDate(row[col.key]) : formatCellValue(row[col.key])}', "formatDate(row[col.key]) : cellText(row[col.key])}");

// Placeholders (both occurrences, single line)
rep('placeholder={f.placeholder}', 'placeholder={f.placeholder ? t(`ismsPhase6.placeholders.${phase6Slug(f.placeholder)}`) : undefined}');

// Pagination Previous/Next standalone lines
s = s.replace(/^ {12}Previous\r?$/gm, '{t(\'common.previous\')}');
s = s.replace(/^ {12}Next\r?$/gm, "{t('common.next')}");

// Cancel buttons (both occurrences, 16-space indent standalone line)
s = s.replace(/^ {16}Cancel\r?$/gm, "{t('common.cancel')}");

// Delete confirmation text
{
  const re = /Are you sure you want to delete <strong>\{deleteRow\[meta\?\.titleField \|\| 'name'\] \|\| deleteRow\.id\}<\/strong>\? This action cannot be undone\./;
  if (!re.test(s)) { console.error('NOT FOUND delete text'); process.exitCode = 1; } else {
    s = s.replace(re, "{t('common.confirmDeleteNamed', { name: String(deleteRow[meta?.titleField || 'name'] ?? deleteRow.id) })}");
  }
}

fs.writeFileSync(target, s);
console.log('done');
