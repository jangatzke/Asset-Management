const fs = require('fs');
const p = 'frontend/src/pages/ISMSPhase6.tsx';
let s = fs.readFileSync(p, 'utf8');

function rep(find, replace) {
  if (!s.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 90)); process.exitCode = 1; return; }
  s = s.split(find).join(replace);
}

// Slug helper for metadata-driven translation keys (ismsPhase6.*)
rep("const actionButtonClassName = 'inline-flex h-8 w-8", "const phase6Slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');\n\nconst actionButtonClassName = 'inline-flex h-8 w-8");

// Error message with field label
rep("throw new Error(`${f.label} must contain valid JSON.`);", "throw new Error(t('ismsPhase6.invalidJsonField', { field: t(`ismsPhase6.fields.${phase6Slug(f.label)}`) }));");

// Banner
rep('<div><h2 className="font-semibold text-blue-950 dark:text-primary-100">Guided operational workflows</h2><p className="text-sm text-primary-800 dark:text-primary-200">This legacy registry is read-only. Create and change records in the guided Supplier, BCM, Audit & CAPA, Training, Metrics, Management Review, Workflow, and Report workflows—never by entering identifiers or JSON.</p></div>', "<div><h2 className=\"font-semibold text-blue-950 dark:text-primary-100\">{t('ismsPhase6.guidedTitle')}</h2><p className=\"text-sm text-primary-800 dark:text-primary-200\">{t('ismsPhase6.guidedText')}</p></div>");
rep("className=\"rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700\">Open workspaces</button>", "className=\"rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700\">{t('ismsPhase6.openWorkspaces')}</button>");

// Resource buttons + active domain line
rep("                    >\n                      {m.label}\n", "                    >\n                      {t(`ismsPhase6.labels.${phase6Slug(m.label)}`)}\n");
rep("{t(`ismsOperations.domains.${activeDomain.key}`)} · {meta?.label}", "{t(`ismsOperations.domains.${activeDomain.key}`)} · {t(`ismsPhase6.labels.${phase6Slug(meta?.label ?? '')}`)}");

// Status filter options
rep("<option key={o.value} value={o.value}>{o.label}</option>\n              ))}\n            </select>", "<option key={o.value} value={o.value}>{t(`ismsPhase6.options.${phase6Slug(o.label)}`)}</option>\n              ))}\n            </select>");

// Record count
rep("{rows.length} record{rows.length !== 1 ? 's' : ''}", "{t('ismsPhase6.recordCount', { count: rows.length })}");

// Empty states
rep("<div className=\"p-6 text-gray-500\">No metadata for this resource.</div>", "<div className=\"p-6 text-gray-500\">{t('ismsPhase6.noMetadata')}</div>");
rep("<div className=\"p-6 text-gray-500\">No records are available in this legacy index. Create records through the relevant guided workflow.</div>", "<div className=\"p-6 text-gray-500\">{t('ismsPhase6.noLegacyRecords')}</div>");

// Table headers + cells
rep("                      label={col.label}", "                      label={t(`ismsPhase6.columns.${phase6Slug(col.label)}`)}");
rep("{formatDate(row[col.key]) : formatCellValue(row[col.key])}", "{formatDate(row[col.key]) : cellText(row[col.key])}");
rep("aria-label={`${t('common.view')}: ${formatCellValue(row[meta.titleField || 'displayId'] ?? row.displayId ?? row.id)}`}", "aria-label={`${t('common.view')}: ${cellText(row[meta.titleField || 'displayId'] ?? row.displayId ?? row.id)}`}");

// Pagination
rep("            Previous\n", "            {t('common.previous')}\n");
rep("<span className=\"text-sm text-gray-600 dark:text-gray-300\">Page {page} of {totalPages}</span>", "<span className=\"text-sm text-gray-600 dark:text-gray-300\">{t('pagination.pageOf', { page, total: totalPages })}</span>");
rep("            Next\n", "            {t('common.next')}\n");

// Detail modal
rep("title={`${meta?.label || ''} Details`}", "title={t('ismsPhase6.detailTitle', { name: t(`ismsPhase6.labels.${phase6Slug(meta?.label ?? '')}`) })}");
rep("<div className=\"text-xs font-medium text-gray-500 dark:text-gray-400 uppercase\">{f.label}</div>", "<div className=\"text-xs font-medium text-gray-500 dark:text-gray-400 uppercase\">{t(`ismsPhase6.fields.${phase6Slug(f.label)}`)}</div>");
rep("{f.type === 'boolean' ? (val ? 'Yes' : 'No') :", "{f.type === 'boolean' ? (val ? t('common.yes') : t('common.no')) :");

// Create/Edit modal
rep("title={`${editRow ? 'Edit' : 'Add'} ${meta?.label.replace(/s$/, '')}`}", "title={`${editRow ? t('common.edit') : t('common.add')} ${t(`ismsPhase6.labels.${phase6Slug(meta?.label ?? '')}`)}`}");
rep("                    {t(f.label)} {required && <span className=\"text-red-500\">*</span>}", "                    {t(`ismsPhase6.fields.${phase6Slug(f.label)}`)} {required && <span className=\"text-red-500\">*</span>}");

// Placeholders (textarea, input)
rep("                        placeholder={f.placeholder}\n                        rows={3}\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100\"\n                      />\n                    ) : f.type === 'select' ? (", "                        placeholder={f.placeholder ? t(`ismsPhase6.placeholders.${phase6Slug(f.placeholder)}`) : undefined}\n                        rows={3}\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100\"\n                      />\n                    ) : f.type === 'select' ? (");
rep("<option value=\"\">-- Select --</option>", "<option value=\"\">{t('common.select')}</option>");
rep("                          <option key={o.value} value={o.value}>{o.label}</option>", "                          <option key={o.value} value={o.value}>{t(`ismsPhase6.options.${phase6Slug(o.label)}`)}</option>");
rep("                        placeholder=\"Enter JSON...\"", "                        placeholder={t('ismsPhase6.enterJson')}");
rep("                        placeholder={f.placeholder}\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100\"\n                      />", "                        placeholder={f.placeholder ? t(`ismsPhase6.placeholders.${phase6Slug(f.placeholder)}`) : undefined}\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100\"\n                      />");

// Form buttons
rep("                Cancel\n              </button>\n              <button\n                onClick={handleSubmit}", "                {t('common.cancel')}\n              </button>\n              <button\n                onClick={handleSubmit}");
rep("{submitLoading ? 'Saving...' : editRow ? 'Save Changes' : 'Create'}", "{submitLoading ? t('common.saving') : editRow ? t('common.save') : t('common.create')}");

// Delete modal
rep("title={`Delete ${meta?.label.replace(/s$/, '')}?`}", "title={t('ismsPhase6.deleteTitle', { name: t(`ismsPhase6.labels.${phase6Slug(meta?.label ?? '')}`) })}");
rep("              Are you sure you want to delete <strong>{deleteRow[meta?.titleField || 'name'] || deleteRow.id}</strong>? This action cannot be undone.\n", "              {t('common.confirmDeleteNamed', { name: String(deleteRow[meta?.titleField || 'name'] ?? deleteRow.id) })}\n");
rep("                Cancel\n              </button>\n              <button\n                onClick={handleDelete}", "                {t('common.cancel')}\n              </button>\n              <button\n                onClick={handleDelete}");
rep("{submitLoading ? 'Deleting...' : 'Delete'}", "{submitLoading ? t('ismsPhase6.deleting') : t('common.delete')}");

// cellText helper (boolean-aware) inside component, after meta definition
rep("  const meta = resourceMetas[resource] || null;", "  const meta = resourceMetas[resource] || null;\n  const cellText = (value: unknown): string => typeof value === 'boolean' ? (value ? t('common.yes') : t('common.no')) : formatCellValue(value);");

fs.writeFileSync(p, s);
console.log('done');
