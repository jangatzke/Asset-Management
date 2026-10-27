/// <reference types="vitest" />
import en from './en.json';
import de from './de.json';
import es from './es.json';
import fr from './fr.json';

declare const test: typeof import('vitest').test;
declare const expect: typeof import('vitest').expect;

const resolveKey = (source: Record<string, any>, key: string) => key.split('.').reduce<any>((value, part) => value?.[part], source);

test('risk list locale keys resolve to translated strings', () => {
  for (const locale of [en, de, es, fr]) {
    expect(resolveKey(locale, 'risks.title')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.title')).not.toBe('risks.title');
    expect(resolveKey(locale, 'risks.searchPlaceholder')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.searchPlaceholder')).not.toBe('risks.searchPlaceholder');
  }
});

test('common.all filter label exists in both locales', () => {
  for (const locale of [en, de, es, fr]) {
    const key = 'common.all';
    const value = resolveKey(locale, key);
    expect(value).toBeDefined();
    expect(value).toEqual(expect.any(String));
    expect(value).not.toBe(key);
    expect(value).not.toBe('');
  }
});

test('common.allStatuses filter label exists in both locales', () => {
  for (const locale of [en, de, es, fr]) {
    const key = 'common.allStatuses';
    const value = resolveKey(locale, key);
    expect(value).toBeDefined();
    expect(value).toEqual(expect.any(String));
    expect(value).not.toBe(key);
    expect(value).not.toBe('');
  }
});

test('shared history locale keys resolve in both locales', () => {
  const keys = [
    'history.title',
    'history.viewHistory',
    'history.actionFilter',
    'history.loading',
    'history.empty',
    'history.loadError',
    'history.system',
    'history.byActor',
    'history.actions.CREATE',
    'history.actions.UPDATE',
    'history.actions.DELETE',
    'history.fields.status',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toBeDefined();
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('database admin locale keys resolve in both locales', () => {
  const keys = [
    'navigation.databaseBackup',
    'databaseAdmin.title',
    'databaseAdmin.configTitle',
    'databaseAdmin.exportButton',
    'databaseAdmin.importButton',
    'databaseAdmin.replaceConfirmationPhrase',
    'databaseAdmin.modes.dryRun',
    'databaseAdmin.modes.append',
    'databaseAdmin.modes.replace',
    'databaseAdmin.messages.dryRunSuccess',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toBeDefined();
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('ticket workflow and SLA locale keys resolve in both locales', () => {
  const keys = [
    'navigation.tickets', 'navigation.ticketSlaSettings',
    'tickets.title', 'tickets.newTicket', 'tickets.searchPlaceholder',
    'tickets.statusLabel', 'tickets.createdByMe', 'tickets.assignedToMe',
    'tickets.types.service_request', 'tickets.priorities.critical',
    'tickets.detail.closeTicket', 'tickets.detail.closurePrompt',
    'ticketSla.title', 'ticketSla.firstResponseHours', 'ticketSla.resolutionHours',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('list-view enhancement keys resolve in all locales', () => {
  const keys = [
    'pagination.goTo', 'pagination.jumpAriaLabel',
    'savedViews.title', 'savedViews.save', 'savedViews.namePlaceholder', 'savedViews.nameRequired', 'savedViews.applied',
    'undo.label', 'undo.done',
    'bulk.select', 'bulk.selectAll', 'bulk.selectedCount', 'bulk.archive', 'bulk.confirmTitle', 'bulk.confirmMessage',
    'bulk.success', 'bulk.partial', 'bulk.failed',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('operations and administration locale catalogs remain complete in both locales', () => {
  const keys = [
    'operationsWorkspace.title', 'operationsWorkspace.workspaces.training', 'operationsWorkspace.actions.runReport',
    'operationsWorkspace.sections.courses', 'operationsWorkspace.sections.assignments',
    'operationsWorkspace.sections.acknowledgements', 'operationsWorkspace.sections.metricDefinitions',
    'operationsWorkspace.sections.valuesTrendsBreaches', 'operationsWorkspace.sections.administrativeDefinitions',
    'operationsWorkspace.sections.contextualInstances', 'operationsWorkspace.sections.actionableTasks',
    'operationsWorkspace.sections.reportDefinitions', 'operationsWorkspace.sections.runResults',
    'operationsWorkspace.sections.exports', 'operationsWorkspace.form.responsibleUser',
    'audit.title', 'audit.findings', 'audit.status.inProgress',
    'bcm.title', 'bcm.continuityPlan', 'bcm.status.underReview',
    'suppliers.title', 'suppliers.exitPlan', 'suppliers.status.underReview',
    'roles.permissionManagement', 'roles.savePermissions',
    'groups.searchUsers', 'groups.selectedRoles',
    'intune.healthStatus', 'intune.syncNow',
    'vmware.configuration', 'vmware.verifyCertificate',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('knowledge base locale keys resolve in all locales', () => {
  const keys = [
    'navigation.knowledgeBase',
    'knowledge.title', 'knowledge.newArticle', 'knowledge.editArticle',
    'knowledge.searchPlaceholder', 'knowledge.empty', 'knowledge.saved', 'knowledge.archived',
    'knowledge.loadError', 'knowledge.saveError', 'knowledge.viewCount', 'knowledge.tagsPlaceholder',
    'knowledge.categories.general', 'knowledge.categories.incident', 'knowledge.categories.risk',
    'knowledge.categories.control', 'knowledge.categories.supplier', 'knowledge.categories.nis2', 'knowledge.categories.service',
    'knowledge.statuses.draft', 'knowledge.statuses.published', 'knowledge.statuses.archived',
    'knowledge.fields.category', 'knowledge.fields.summary', 'knowledge.fields.content', 'knowledge.fields.tags',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('supply chain overview locale keys resolve in all locales', () => {
  const keys = [
    'navigation.supplyChain',
    'supplyChain.title', 'supplyChain.description', 'supplyChain.loadError',
    'supplyChain.searchLabel', 'supplyChain.searchPlaceholder', 'supplyChain.empty',
    'supplyChain.summaryLabel', 'supplyChain.summary.total', 'supplyChain.summary.nis2Relevant',
    'supplyChain.summary.criticalHigh', 'supplyChain.summary.missingExitStrategy', 'supplyChain.summary.reviewOverdue',
    'supplyChain.filters.nis2Only',
    'supplyChain.columns.supplier', 'supplyChain.columns.contracts', 'supplyChain.columns.openRisks',
    'supplyChain.columns.latestAssessment', 'supplyChain.columns.nextReview',
    'supplyChain.fields.criticality', 'supplyChain.fields.exitStrategy', 'supplyChain.fields.dataProtection',
    'supplyChain.sections.contracts', 'supplyChain.sections.risks',
    'supplyChain.noContracts', 'supplyChain.noRisks', 'supplyChain.noAssessment', 'supplyChain.noServices',
    'supplyChain.missingExitStrategy', 'supplyChain.nis2Badge', 'supplyChain.renewsOn', 'supplyChain.openSupplier',
    // Labels rendered by the page from existing catalogs.
    'assets.criticality.low', 'assets.criticality.medium', 'assets.criticality.high', 'assets.criticality.critical',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('control coverage matrix locale keys resolve in all locales', () => {
  const keys = [
    'navigation.controlCoverage',
    'controlCoverage.title', 'controlCoverage.description', 'controlCoverage.loadError',
    'controlCoverage.searchLabel', 'controlCoverage.searchPlaceholder', 'controlCoverage.empty',
    'controlCoverage.summaryLabel', 'controlCoverage.summary.total', 'controlCoverage.summary.covered',
    'controlCoverage.summary.uncovered', 'controlCoverage.summary.criticalUncovered',
    'controlCoverage.filters.uncoveredOnly',
    'controlCoverage.columns.asset', 'controlCoverage.columns.coverage', 'controlCoverage.columns.effective',
    'controlCoverage.fields.criticality', 'controlCoverage.fields.complianceRelevance', 'controlCoverage.fields.dataProtection',
    'controlCoverage.sections.controls', 'controlCoverage.noControls', 'controlCoverage.uncoveredBadge', 'controlCoverage.openAsset',
    // Labels rendered by the page from existing catalogs.
    'assets.criticality.low', 'assets.criticality.medium', 'assets.criticality.high', 'assets.criticality.critical',
    'assets.lifecycleStatus.planned', 'assets.lifecycleStatus.active',
    'controls.implementationStatus.planned', 'controls.implementationStatus.implemented', 'controls.implementationStatus.effective',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('KRI dashboard locale keys resolve in all locales', () => {
  const keys = [
    'navigation.kriDashboard',
    'kri.title', 'kri.description', 'kri.typeLabel',
    'kri.types.KRI', 'kri.types.KPI', 'kri.types.KCI',
    'kri.refresh', 'kri.manageMetrics', 'kri.loadError', 'kri.loading', 'kri.noIndicators', 'kri.summaryLabel',
    'kri.status.critical', 'kri.status.warning', 'kri.status.none', 'kri.status.noData',
    'kri.columns.name', 'kri.columns.latest', 'kri.columns.thresholds', 'kri.columns.trend', 'kri.columns.history', 'kri.columns.measuredAt',
    'kri.trend.up', 'kri.trend.down', 'kri.trend.stable', 'kri.trend.none',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('asset graph accessibility locale keys resolve in all locales', () => {
  const keys = [
    'graph.ariaLabel',
    'graph.a11y.summary',
    'graph.a11y.statusNodes',
    'graph.a11y.focusAnnouncement',
    'graph.a11y.focusAnnouncementPlain',
    'graph.a11y.listLabel',
    'graph.a11y.keyboardHint',
    'assets.criticality.low',
    'assets.criticality.medium',
    'assets.criticality.high',
    'assets.criticality.critical',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});

test('AI assistant admin locale keys resolve in all locales', () => {
  const keys = [
    'aiAssistant.title', 'aiAssistant.subtitle', 'aiAssistant.connection',
    'aiAssistant.baseUrl', 'aiAssistant.model', 'aiAssistant.apiKey',
    'aiAssistant.automation', 'aiAssistant.taskTriage', 'aiAssistant.taskKnowledge',
    'aiAssistant.testConnection', 'aiAssistant.runNow', 'aiAssistant.activityLog',
    'aiAssistant.noEntries', 'aiAssistant.loading',
  ];

  for (const locale of [en, de, es, fr]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});
