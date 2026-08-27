import operationsHelpersSource from './operationsHelpers.ts?raw';
import operationsWorkspaceSource from './OperationsWorkspace.tsx?raw';

describe('Operations workspace optional number serialization', () => {
  test('preserves zero while omitting only absent or empty optional numeric fields', async () => {
    const source = operationsHelpersSource;

    expect(source).toContain("const value = form.get(key);");
    expect(source).toContain("return value === null || value === '' ? undefined : Number(value);");
  });

  test('uses optional number serialization for score and every metric threshold', async () => {
    const source = operationsWorkspaceSource;

    expect(source).toContain("score: optionalNumber(form, 'score')");
    for (const threshold of ['warningMin', 'warningMax', 'criticalMin', 'criticalMax']) {
      expect(source).toContain(`${threshold}: optionalNumber(form, '${threshold}')`);
    }
  });
});
