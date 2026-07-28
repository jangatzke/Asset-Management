import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('Phase 0 documentation consistency', () => {
  const requirementIds = [
    'AUTHZ-001',
    'AUTHZ-002',
    'AUTHN-001',
    'AUTHN-002',
    'OIDC-001',
    'AUD-001',
    'DTO-001',
    'UI-001',
    'OPS-013',
    'OPS-014',
    'CI-003',
  ];

  it('documents every Phase 0-5 consolidation requirement in requirements and matrix', () => {
    const requirements = read('docs/requirements.md');
    const matrix = read('docs/compliance-matrix.yml');

    for (const id of requirementIds) {
      expect(requirements).toContain(id);
      expect(matrix).toContain(`id: ${id}`);
    }
  });

  it('records the mandatory baseline categories', () => {
    const baseline = read('docs/refactoring-baseline.md');
    const categories = [
      'Commit SHA',
      'Datum',
      'Backend Build',
      'Frontend Build',
      'Shared Build',
      'Prisma Validate',
      'Prisma Migration status',
      'Unit Test Count',
      'Integration Test Count',
      'Frontend Test Count',
      'Lint',
      'CI/CD Workflow',
      'bekannte Fehler',
      'bekannte Warnungen',
    ];

    for (const category of categories) {
      expect(baseline).toContain(`| ${category} |`);
    }
  });

  it('documents all phases and the mandatory stop after Phase 5', () => {
    const plan = read('docs/refactoring-plan.md');

    for (let phase = 0; phase <= 14; phase += 1) {
      expect(plan).toContain(`Phase ${phase}`);
    }

    expect(plan).toContain('Mandatory stop after Phase 5');
    expect(plan).toContain('no Phase 6 or later work may start automatically');
  });

  it('does not count Phase 0 planning placeholders as implementation evidence', () => {
    const matrix = read('docs/compliance-matrix.yml');
    const plannedPhase0Ids = ['AUTHN-001', 'AUTHN-002', 'AUD-001', 'DTO-001', 'UI-001'];

    for (const id of plannedPhase0Ids) {
      const entries = matrix.split('\n- id: ').filter((entry) => entry.startsWith(id) || entry.startsWith(`- id: ${id}`));
      const entry = entries.find((candidate) => candidate.includes('Phase 0 documents this requirement only'));
      expect(entry).toBeDefined();
      expect(entry).toContain('status: planned');
      expect(entry).toContain('implementation: []');
      expect(entry).toContain('Phase 0 documents this requirement only');
    }
  });
});
