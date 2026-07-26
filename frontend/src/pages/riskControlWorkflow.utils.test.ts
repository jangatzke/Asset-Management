import {
  implementationRiskDisplayRows,
  riskControlDisplayRows,
  riskControlEffectivenessTranslationKey,
  treatmentActionDisplayRows,
} from './riskControlWorkflow.utils';

test('renders existing RiskControls from assessment effectiveness and not implementationStatus', () => {
    const rows = riskControlDisplayRows([
      {
        id: 'rc-1',
        controlImplementation: {
          implementationStatus: 'effective',
          control: { title: 'MFA' },
        },
        assessments: [{ id: 'a-1', effectivenessStatus: 'partially_effective', assessedAt: '2026-01-01T00:00:00.000Z' }],
      },
    ]);

    expect(rows).toEqual([
      {
        id: 'rc-1',
        title: 'MFA',
        effectivenessKey: 'risks.controls.effectiveness.partially_effective',
        implementationReadiness: 'effective',
      },
    ]);
});

test('labels implemented but not assessed controls as not assessed', () => {
    expect(riskControlEffectivenessTranslationKey({ id: 'rc-1', controlImplementation: { implementationStatus: 'implemented' }, assessments: [] }))
      .toBe('risks.controls.notAssessed');
});

test('keeps TreatmentAction display separate from RiskControls', () => {
    expect(treatmentActionDisplayRows([{ id: 'ta-1', title: 'Improve MFA', controlImplementationId: 'ci-1' }])).toEqual([
      { id: 'ta-1', title: 'Improve MFA', controlImplementationId: 'ci-1', isRiskControl: false },
    ]);
});

test('renders ControlImplementation linked risks with latest assessment labels', () => {
    expect(implementationRiskDisplayRows([
      { riskControlId: 'rc-1', displayId: 'RSK-1', title: 'Unauthorized access', latestAssessment: { effectivenessStatus: 'effective' } },
      { riskControlId: 'rc-2', displayId: 'RSK-2', title: 'Data loss', latestAssessment: null },
    ])).toEqual([
      { id: 'rc-1', title: 'RSK-1 Unauthorized access', effectivenessKey: 'risks.controls.effectiveness.effective' },
      { id: 'rc-2', title: 'RSK-2 Data loss', effectivenessKey: 'risks.controls.notAssessed' },
    ]);
});
