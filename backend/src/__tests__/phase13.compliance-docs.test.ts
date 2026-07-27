import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/**
 * Phase 13 compliance documentation model tests.
 * 
 * Enforces the corrected compliance documentation model:
 * - No forbidden wording claiming organizational ISO 27001 compliance
 *   (except in meta-commentary headers that list what is forbidden)
 * - Compliance matrix uses dimension field (application_coverage / org_compliance)
 * - Status terms follow the Phase 13 model
 */
describe('Phase 13 compliance documentation model', () => {
  const complianceDocs = [
    'docs/compliance-matrix.yml',
    'docs/compliance-matrix.md',
    'docs/requirements.md',
    'docs/final-verification-report.md',
    'README.md',
  ];

  /**
   * Check content for forbidden organizational compliance claims.
   * Lines that are pure comments (starting with # or >) listing the forbidden terms
   * as meta-references are excluded from this check.
   */
  function hasForbiddenClaim(content: string): boolean {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment-only lines that list forbidden terms as meta-references
      if (trimmed.startsWith('#') || trimmed.startsWith('>')) continue;
      if (/ISO\s+27001\s+compliant/i.test(trimmed)) return true;
      if (/compliant with ISO 27001/i.test(trimmed)) return true;
      if (/meets ISO 27001 requirements/i.test(trimmed)) return true;
    }
    return false;
  }

  it('no compliance doc contains forbidden organizational compliance wording', () => {
    for (const doc of complianceDocs) {
      const content = read(doc);
      expect(hasForbiddenClaim(content)).toBe(false);
    }
  });

  it('compliance-matrix.yml has dimension field on all entries', () => {
    const content = read('docs/compliance-matrix.yml');
    const blocks = content.split(/^- id:/);
    for (const block of blocks) {
      if (!block.trim()) continue;
      expect(block).toContain('dimension:');
    }
  });

  it('compliance-matrix.yml uses corrected status terms', () => {
    const content = read('docs/compliance-matrix.yml');
    expect(content).not.toContain('status: compliant');
    expect(content).not.toContain('status: non_compliant');
  });

  it('compliance-matrix.md has documentation model note', () => {
    const content = read('docs/compliance-matrix.md');
    expect(content).toContain('Application Coverage');
    expect(content).toContain('Organization Compliance Assessment');
  });

  it('requirements.md does not use ISO 27001 in title', () => {
    const content = read('docs/requirements.md');
    const lines = content.split('\n');
    expect(lines[0]).not.toContain('(ISO 27001)');
  });

  it('final-verification-report.md does not claim organizational ISO 27001 compliance', () => {
    const content = read('docs/final-verification-report.md');
    expect(content).not.toContain(
      'Based on this comprehensive audit, the system meets the following ISO 27001:2022 requirements:'
    );
    expect(content).toContain('Application Coverage Summary');
  });

  it('README.md does not claim organizational ISO 27001 compliance', () => {
    const content = read('README.md');
    expect(content).not.toContain(
      'Built for ISO 27001:2022 compliance, NIS-2 directive adherence, and BSI regulatory requirements.'
    );
    expect(content).toContain('Application Requirement Coverage');
  });

  it('compliance-matrix.yml header documents forbidden wording', () => {
    const content = read('docs/compliance-matrix.yml');
    expect(content).toContain('Forbidden wording');
    expect(content).toContain('"ISO 27001 compliant"');
  });
});
