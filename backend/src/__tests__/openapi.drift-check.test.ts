/**
 * Phase 1.5 drift-check failure-mode test.
 *
 * Runs [`check-openapi-coverage.js`](scripts/check-openapi-coverage.js:1) against a
 * fixture spec that documents only one prefix. The check must fail with exit code 1
 * and report the registered prefixes that have no documented path.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-openapi-coverage.js');

function runScript(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
}

describe('OpenAPI drift check failure mode', () => {
  let tempDir: string;
  let specFile: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-drift-'));
    specFile = path.join(tempDir, 'fixture-openapi.yaml');
    fs.writeFileSync(
      specFile,
      [
        'openapi: 3.1.0',
        'servers:',
        '  - url: http://localhost:3001/api/v1',
        'paths:',
        '  /assets:',
        '    get:',
        '      summary: List assets',
        '      responses:',
        "        '200': { description: Assets }",
        '',
      ].join('\n'),
      'utf8',
    );
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exits 1 and lists the registered prefixes missing from the fixture spec', () => {
    const result = runScript([`--spec=${specFile}`]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('OpenAPI coverage check FAILED');
    expect(result.stdout).toContain('Missing documented paths for registered modules');
    expect(result.stdout).toContain('/api/v1/risks');
  });

  it('exits 0 against the real spec', () => {
    const result = runScript([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OpenAPI coverage check PASSED');
  });
});
