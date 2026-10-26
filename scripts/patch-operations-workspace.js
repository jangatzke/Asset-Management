const fs = require('fs');
const p = 'frontend/src/pages/OperationsWorkspace.tsx';
let src = fs.readFileSync(p, 'utf8');
let missing = 0;

function rep(find, replace) {
  if (!src.includes(find)) { console.log('NOT FOUND:', JSON.stringify(find.slice(0, 80))); missing++; return; }
  src = src.split(find).join(replace);
}

// Modal title: dynamic kind -> translation key
rep(`title={kind.replace(/([A-Z])/g, ' $1')}`, 'title={t(`operationsWorkspace.modalTitles.${kind}`)}');

// Field labels (Field/choose take plain strings)
rep('label="Course title"', "label={t('operationsWorkspace.form.courseTitle')}");
rep('label="Category"', "label={t('operationsWorkspace.form.category')}");
rep('label="Description"', "label={t('common.description')}");
rep("choose(courses, 'Course')", "choose(courses, t('operationsWorkspace.form.course'))");
rep('label="Due date"', "label={t('operationsWorkspace.form.dueDate')}");
rep('label="Notes"', "label={t('operationsWorkspace.form.notes')}");
rep("choose(assignments, 'Assignment')", "choose(assignments, t('operationsWorkspace.form.assignment'))");
rep('label="Score (%)"', "label={t('operationsWorkspace.form.score')}");
rep('label="Acknowledgement note"', "label={t('operationsWorkspace.form.acknowledgementNote')}");
rep('label="Metric name"', "label={t('operationsWorkspace.form.metricName')}");
rep('label="Unit"', "label={t('operationsWorkspace.form.unit')}");
rep('label="Warning minimum"', "label={t('operationsWorkspace.form.warningMin')}");
rep('label="Critical minimum"', "label={t('operationsWorkspace.form.criticalMin')}");
rep('label="Warning maximum"', "label={t('operationsWorkspace.form.warningMax')}");
rep('label="Critical maximum"', "label={t('operationsWorkspace.form.criticalMax')}");
rep("choose(definitions, 'Metric')", "choose(definitions, t('operationsWorkspace.form.metric'))");
rep('label="Measured value"', "label={t('operationsWorkspace.form.measuredValue')}");
rep('label="Measured at"', "label={t('operationsWorkspace.form.measuredAt')}");
rep('label="Source"', "label={t('operationsWorkspace.form.source')}");
rep('label="Comment"', "label={t('operationsWorkspace.form.comment')}");
rep('label="Review title"', "label={t('operationsWorkspace.form.reviewTitle')}");
rep('label="Review date"', "label={t('operationsWorkspace.form.reviewDate')}");
rep('label="Agenda topic"', "label={t('operationsWorkspace.form.agendaTopic')}");
rep('label="Initial decision"', "label={t('operationsWorkspace.form.initialDecision')}");
rep("choose(reviews, 'Management review')", "choose(reviews, t('operationsWorkspace.form.managementReview'))");
rep('label="Action"', "label={t('operationsWorkspace.form.action')}");
rep('>Entity type<select', "{t('operationsWorkspace.form.entityType')}<select");
rep('<option value="" disabled>Select a workflow definition first</option>', "<option value=\"\" disabled>{t('operationsWorkspace.form.selectWorkflowFirst')}</option>");
rep('label="Context entity"', "label={t('operationsWorkspace.form.contextEntity')}");
rep("choose(instances, 'Workflow instance')", "choose(instances, t('operationsWorkspace.form.workflowInstance'))");
rep('>Action<select', "{t('operationsWorkspace.form.action')}<select");
rep("'Loading available actions\u2026'", "t('operationsWorkspace.form.loadingActions')");
rep("'Select an allowed action'", "t('operationsWorkspace.form.selectAllowedAction')");
rep("'No actions available for this state'", "t('operationsWorkspace.form.noActionsForState')");
rep('label="Report name"', "label={t('operationsWorkspace.form.reportName')}");
rep('label="Data module"', "label={t('operationsWorkspace.form.dataModule')}");
rep('label="Columns (one per line)"', "label={t('operationsWorkspace.form.columnsOnePerLine')}");
rep('>Format<select', "{t('operationsWorkspace.form.format')}<select");
rep("choose(reports, 'Report definition')", "choose(reports, t('operationsWorkspace.form.reportDefinition'))");
rep('className="rounded border px-3 py-2 text-sm">Cancel</button>', "className=\"rounded border px-3 py-2 text-sm\">{t('common.cancel')}</button>");
rep('<Button type="submit">Save</Button>', "<Button type=\"submit\">{t('common.save')}</Button>");

fs.writeFileSync(p, src);
console.log(missing ? `done with ${missing} missing` : 'done');
process.exit(missing ? 1 : 0);
