/// <reference types="vitest" />
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

declare const describe: typeof import('vitest').describe;
declare const expect: typeof import('vitest').expect;
declare const test: typeof import('vitest').test;

const sourcePath = fileURLToPath(new URL('./CostPlanning.tsx', import.meta.url));
const readCostPlanningSource = () => readFile(sourcePath, 'utf8');

describe('Cost planning manual procurement flow', () => {
  test('keeps the add button wired to a visible submission handler', async () => {
    const source = await readCostPlanningSource();

    expect(source).toContain('const createManual = async () =>');
    expect(source).toContain('onClick={createManual}');
    expect(source).toContain('costPlanningApi.createManualItem');
    expect(source).toContain("setMessage(t('costPlanning.manualValidationError'))");
    expect(source).toContain("setMessage(apiErrorMessage(error, t('costPlanning.manualCreateError')))" );
  });

  test('supports persisted supplier lookup and inline creation before submitting the procurement item', async () => {
    const source = await readCostPlanningSource();

    expect(source).toContain('costPlanningApi.searchSuppliers');
    expect(source).toContain('costPlanningApi.createSupplier');
    expect(source).toContain('supplierId: data.id');
    expect(source).toContain('supplierId: manual.supplierId || undefined');
  });
});

describe('Cost planning candidate bulk selection', () => {
  test('selects only selectable visible candidates and exposes the accessible select-all state', async () => {
    const source = await readCostPlanningSource();

    expect(source).toContain('const selectableCandidateKeys = useMemo(() => candidates.filter((candidate) => !candidate.alreadyInPlan).map((candidate) => candidate.candidateKey), [candidates]);');
    expect(source).toContain('const isCandidateSelectionIndeterminate = selectedVisibleCandidateCount > 0 && !allSelectableCandidatesSelected;');
    expect(source).toContain('selectAllCandidatesCheckboxRef.current.indeterminate = isCandidateSelectionIndeterminate');
    expect(source).toContain("aria-label={t('costPlanning.selectAllCandidates')}");
    expect(source).toContain("aria-checked={isCandidateSelectionIndeterminate ? 'mixed' : allSelectableCandidatesSelected}");
    expect(source).toContain('disabled={selectableCandidateKeys.length === 0}');
    expect(source).toContain('onChange={toggleAllVisibleCandidates}');
    expect(source).toContain('selectableCandidateKeys.every((candidateKey) => next.has(candidateKey))');
    expect(source).toContain('candidate.alreadyInPlan} checked={selected.includes(candidate.candidateKey)} onChange={(e) => toggleCandidate(candidate.candidateKey, e.target.checked)}');
  });
});
