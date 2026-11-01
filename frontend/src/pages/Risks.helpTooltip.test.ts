/// <reference types="vitest" />
import risksSource from './Risks.tsx?raw';

/**
 * Phase 2.4 integration guard.
 *
 * `mitigationDimension` is the only field from the Phase 2.4 scope that exists
 * in a rendered frontend form ([`Risks.tsx`](frontend/src/pages/Risks.tsx:1),
 * risk-control modal). `riskClasses` only exists in the backend Prisma model /
 * shared RiskMethod type and has no frontend form, so it is intentionally not
 * wired here.
 *
 * Rendering the full Risks page needs every API/Toast/Router provider, so this
 * test asserts the wiring statically, mirroring the repo's existing
 * `?raw`-based integration tests (e.g. CostPlanning.test.tsx).
 */
describe('Phase 2.4 HelpTooltip integration', () => {
  test('risk-control form labels mitigationDimension and mounts HelpTooltip next to it', () => {
    expect(risksSource).toContain("import HelpTooltip from '../components/HelpTooltip';");
    expect(risksSource).toContain("labelKey=\"risks.fields.mitigationDimension.label\"");
    expect(risksSource).toContain("bodyKey=\"risks.fields.mitigationDimension.description\"");
    expect(risksSource).toContain("<HelpTooltip");
    expect(risksSource).toContain("t('risks.fields.mitigationDimension.label')");
    expect(risksSource).toContain('id="risk-control-mitigation-dimension"');
  });

  test('no other field was refactored or given a tooltip', () => {
    const helpTooltipUsages = (risksSource.match(/<HelpTooltip/g) ?? []).length;
    expect(helpTooltipUsages).toBe(1);
  });

  test('riskClasses is not present in the frontend Risks form (boundary)', () => {
    expect(risksSource).not.toContain('riskClasses');
  });
});
