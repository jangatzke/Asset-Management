/// <reference types="vitest" />
import en from './en.json';
import de from './de.json';

declare const test: typeof import('vitest').test;
declare const expect: typeof import('vitest').expect;

const resolveKey = (source: Record<string, any>, key: string) => key.split('.').reduce<any>((value, part) => value?.[part], source);

test('risk list locale keys resolve to translated strings', () => {
  for (const locale of [en, de]) {
    expect(resolveKey(locale, 'risks.title')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.title')).not.toBe('risks.title');
    expect(resolveKey(locale, 'risks.searchPlaceholder')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.searchPlaceholder')).not.toBe('risks.searchPlaceholder');
  }
});

test('common.all filter label exists in both locales', () => {
  for (const locale of [en, de]) {
    const key = 'common.all';
    const value = resolveKey(locale, key);
    expect(value).toBeDefined();
    expect(value).toEqual(expect.any(String));
    expect(value).not.toBe(key);
    expect(value).not.toBe('');
  }
});

test('common.allStatuses filter label exists in both locales', () => {
  for (const locale of [en, de]) {
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

  for (const locale of [en, de]) {
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

  for (const locale of [en, de]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toBeDefined();
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

  for (const locale of [en, de]) {
    for (const key of keys) {
      const value = resolveKey(locale, key);
      expect(value).toEqual(expect.any(String));
      expect(value).not.toBe(key);
      expect(value).not.toBe('');
    }
  }
});
