import {
  ISO27001_ANNEX_A_2022_CONTROLS,
  ISO27001_ANNEX_A_2022_CONTROL_COUNT,
} from '../data/iso27001AnnexA2022';

describe('ISO/IEC 27001:2022 Annex A reference catalogue', () => {
  it('contains all 93 uniquely identified Annex A controls', () => {
    expect(ISO27001_ANNEX_A_2022_CONTROL_COUNT).toBe(93);
    expect(new Set(ISO27001_ANNEX_A_2022_CONTROLS.map((control) => control.controlId)).size).toBe(93);
    expect(ISO27001_ANNEX_A_2022_CONTROLS[0].controlId).toBe('A.5.1');
    expect(ISO27001_ANNEX_A_2022_CONTROLS.at(-1)?.controlId).toBe('A.8.34');
  });

  it('retains the Annex A theme distribution', () => {
    const countByCategory = ISO27001_ANNEX_A_2022_CONTROLS.reduce<Record<string, number>>((counts, control) => {
      counts[control.category] = (counts[control.category] ?? 0) + 1;
      return counts;
    }, {});

    expect(countByCategory).toEqual({
      Organizational: 37,
      People: 8,
      Physical: 14,
      Technological: 34,
    });
  });

  it('stores a non-empty implementation objective for every control', () => {
    expect(ISO27001_ANNEX_A_2022_CONTROLS.every((control) => control.title.length > 0 && control.objective.length > 0)).toBe(true);
  });
});
