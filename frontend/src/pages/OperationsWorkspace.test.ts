/// <reference types="vitest" />
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

declare const describe: typeof import('vitest').describe;
declare const expect: typeof import('vitest').expect;
declare const test: typeof import('vitest').test;

const sourcePath = fileURLToPath(new URL('./OperationsWorkspace.tsx', import.meta.url));
const readOperationsWorkspaceSource = () => readFile(sourcePath, 'utf8');

describe('Operations workspace optional number serialization', () => {
  test('preserves zero while omitting only absent or empty optional numeric fields', async () => {
    const source = await readOperationsWorkspaceSource();

    expect(source).toContain("const value = form.get(key);");
    expect(source).toContain("return value === null || value === '' ? undefined : Number(value);");
  });

  test('uses optional number serialization for score and every metric threshold', async () => {
    const source = await readOperationsWorkspaceSource();

    expect(source).toContain("score: optionalNumber(form, 'score')");
    for (const threshold of ['warningMin', 'warningMax', 'criticalMin', 'criticalMax']) {
      expect(source).toContain(`${threshold}: optionalNumber(form, '${threshold}')`);
    }
  });
});
