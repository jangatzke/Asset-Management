export interface RiskControlAssessmentLike {
  id?: string;
  effectivenessStatus?: string;
  assessedAt?: string;
}

export interface RiskControlLinkLike {
  id: string;
  controlImplementationId?: string;
  controlImplementation?: { implementationStatus?: string; control?: { title?: string } };
  assessments?: RiskControlAssessmentLike[];
}

export interface TreatmentActionLike {
  id: string;
  title?: string;
  controlImplementationId?: string | null;
}

export interface ImplementationRiskLike {
  riskControlId: string;
  displayId?: string;
  title?: string;
  latestAssessment?: { effectivenessStatus?: string } | null;
}

export const latestRiskControlAssessment = (link: RiskControlLinkLike) =>
  (link.assessments ?? [])
    .slice()
    .sort((a, b) => String(b.assessedAt ?? '').localeCompare(String(a.assessedAt ?? '')))[0];

export const riskControlEffectivenessTranslationKey = (link: RiskControlLinkLike) => {
  const assessment = latestRiskControlAssessment(link);
  return assessment?.effectivenessStatus
    ? `risks.controls.effectiveness.${assessment.effectivenessStatus}`
    : 'risks.controls.notAssessed';
};

export const riskControlDisplayRows = (links: RiskControlLinkLike[]) =>
  links.map((link) => ({
    id: link.id,
    title: link.controlImplementation?.control?.title ?? link.controlImplementationId ?? link.id,
    effectivenessKey: riskControlEffectivenessTranslationKey(link),
    implementationReadiness: link.controlImplementation?.implementationStatus ?? null,
  }));

export const treatmentActionDisplayRows = (actions: TreatmentActionLike[]) =>
  actions.map((action) => ({
    id: action.id,
    title: action.title ?? action.id,
    controlImplementationId: action.controlImplementationId ?? null,
    isRiskControl: false,
  }));

export const implementationRiskDisplayRows = (risks: ImplementationRiskLike[]) =>
  risks.map((risk) => ({
    id: risk.riskControlId,
    title: [risk.displayId, risk.title].filter(Boolean).join(' '),
    effectivenessKey: risk.latestAssessment?.effectivenessStatus
      ? `risks.controls.effectiveness.${risk.latestAssessment.effectivenessStatus}`
      : 'risks.controls.notAssessed',
  }));
