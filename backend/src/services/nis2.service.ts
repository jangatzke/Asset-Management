import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

/**
 * NIS2 Sectors (NIS2-Umsetzungsgesetz — NIS2UmsuCG)
 *
 * Die 18 Sektoren des Anhangs des NIS2-Umsetzungsgesetzes.
 */
export const NIS2_SECTORS = [
  {
    key: 'energy',
    nameDe: 'Energie',
    nameEn: 'Energy',
    subSectors: ['Strom', 'Gas', 'Öl', 'Energieübertragung und -verteilung'],
  },
  {
    key: 'transport',
    nameDe: 'Verkehr',
    nameEn: 'Transport',
    subSectors: ['Luftfahrt', 'Bahn', 'Straßenverkehr', 'Wasserfahrt', 'Öffentlicher Nahverkehr'],
  },
  {
    key: 'banking',
    nameDe: 'Bankwesen',
    nameEn: 'Banking',
    subSectors: ['Kreditinstitute', 'Zahlungsabwicklung'],
  },
  {
    key: 'financial-market-infra',
    nameDe: 'Finanzmarkt-Infrastruktur',
    nameEn: 'Financial Market Infrastructures',
    subSectors: ['Wertpapierhandel', 'Klare Gegenparteien (CCP)', 'Verwahrung'],
  },
  {
    key: 'health',
    nameDe: 'Gesundheit',
    nameEn: 'Health',
    subSectors: ['Herstellende Gesundheitsanbieter', 'Versorgende Gesundheitsanbieter', 'Notfallversorgung', 'Pharma-Produktion'],
  },
  {
    key: 'water',
    nameDe: 'Wasserversorgung',
    nameEn: 'Water Supply',
    subSectors: ['Trinkwasserversorgung', 'Abwasserentsorgung'],
  },
  {
    key: 'digital-infrastructure',
    nameDe: 'Digitale Infrastruktur',
    nameEn: 'Digital Infrastructure',
    subSectors: ['Internet Exchange', 'Cloud Computing Services', 'Rechenzentren', 'Data Centre Interconnect', 'Internet Service Provider (ISP)', 'Domain Name Systems (DNS)'],
  },
  {
    key: 'ict-service-mgmt',
    nameDe: 'IT-Dienstleistungsmanagement',
    nameEn: 'ICT Service Management',
    subSectors: ['Managed Security Service Provider (MSSP)', 'Software und Hardware (Vertrieb)', 'IT-Projektmanagement', 'Softwareentwicklung'],
  },
  {
    key: 'space',
    nameDe: 'Weltraum',
    nameEn: 'Space',
    subSectors: ['Satelliten', 'Satellitengrundinfrastruktur', 'Weltraumbetrieb'],
  },
  {
    key: 'public-admin',
    nameDe: 'Öffentliche Verwaltung',
    nameEn: 'Public Administration',
    subSectors: ['Verwaltungen allgemein', 'Zertifizierungsstellen (Trust Service Providers)'],
  },
  {
    key: 'postal',
    nameDe: 'Post und Kurier',
    nameEn: 'Postal and Courier Services',
    subSectors: ['Post', 'Kurierdienste', 'Paketdienste'],
  },
  {
    key: 'waste',
    nameDe: 'Abfallwirtschaft',
    nameEn: 'Waste Management',
    subSectors: ['Siedlungsabfall', 'Gefährlicher Abfall'],
  },
  {
    key: 'chemicals',
    nameDe: 'Chemie',
    nameEn: 'Chemicals',
    subSectors: ['Industrielle Chemie', 'Pharmazeutische Chemie'],
  },
  {
    key: 'food',
    nameDe: 'Lebensmittel',
    nameEn: 'Food',
    subSectors: ['Lebensmittelproduktion', 'Lebensmittelverteilung'],
  },
  {
    key: 'construction',
    nameDe: 'Baugewerbe',
    nameEn: 'Construction',
    subSectors: ['Bauunternehmen', 'Baustoffproduktion'],
  },
  {
    key: 'digital',
    nameDe: 'Digitale Produkte',
    nameEn: 'Digital Products',
    subSectors: ['Endgeräte', 'Sicherheitskomponenten'],
  },
  {
    key: 'ict-education',
    nameDe: 'IT-Schulung',
    nameEn: 'ICT Education',
    subSectors: ['IT-Ausbildungseinrichtungen'],
  },
  {
    key: 'research',
    nameDe: 'Forschung und Entwicklung',
    nameEn: 'Research and Development',
    subSectors: ['Forschungseinrichtungen', 'Forschungsdatenverarbeitung'],
  },
];

/**
 * NIS2 v2.0 Applicability Questionnaire.
 * Implements sector-based classification with employee count,
 * revenue and balance sheet thresholds per NIS2UmsuCG.
 */
export const NIS2_APPLICABILITY_QUESTIONNAIRE = {
  version: '2.0.0',
  title: 'NIS2 Anwendbarkeits-Fragebogen',
  description: 'Ermittelt, ob die Organisation als besonders wichtige oder wichtige Einrichtung einzustufen ist.',
  questions: [
    {
      id: 'sector',
      type: 'select',
      labelDe: 'Sektor',
      labelEn: 'Sector',
      options: NIS2_SECTORS.map((s) => ({ value: s.key, labelDe: s.nameDe, labelEn: s.nameEn })),
      required: true,
    },
    {
      id: 'employeeCount',
      type: 'number',
      labelDe: 'Anzahl der Beschäftigten',
      labelEn: 'Number of employees',
      required: true,
    },
    {
      id: 'annualRevenue',
      type: 'number',
      labelDe: 'Jahresumsatz in Mio. €',
      labelEn: 'Annual revenue in Mio. €',
      required: true,
    },
    {
      id: 'balanceSheetTotal',
      type: 'number',
      labelDe: 'Bilanzsumme in Mio. €',
      labelEn: 'Balance sheet total in Mio. €',
      required: true,
    },
  ],
  scoringRules: {
    essential_entity: {
      condition: 'employeeCount >= 250 OR (annualRevenue >= 50 AND balanceSheetTotal >= 43)',
      labelDe: 'Besonders wichtige Einrichtung (bwE)',
      labelEn: 'Essential Entity',
    },
    important_entity: {
      condition: 'employeeCount >= 50 OR (annualRevenue >= 10 AND balanceSheetTotal >= 10)',
      labelDe: 'Wichtige Einrichtung (wE)',
      labelEn: 'Important Entity',
    },
    not_applicable: {
      condition: 'Below important entity thresholds',
      labelDe: 'Nicht anwendbar',
      labelEn: 'Not Applicable',
    },
  },
};

export const NIS2_TOPICS = [
  { key: 'risk_management', title: 'Risk management policies and information system security' },
  { key: 'incident_handling', title: 'Incident handling' },
  { key: 'business_continuity', title: 'Business continuity, backup and crisis management' },
  { key: 'supply_chain_security', title: 'Supply-chain security' },
  { key: 'secure_acquisition', title: 'Security in acquisition, development and maintenance' },
  { key: 'effectiveness_assessment', title: 'Policies and procedures to assess effectiveness' },
  { key: 'cyber_hygiene_training', title: 'Basic cyber hygiene and training' },
  { key: 'cryptography', title: 'Cryptography and encryption' },
  { key: 'human_resources_access', title: 'Human resources security and access control' },
  { key: 'asset_management_mfa', title: 'Asset management, MFA and secured communications' },
];

/**
 * NIS2-Anwendbarkeits-Prüfung nach NIS2UmsuCG:
 * - bwE (essential): ≥ 250 MA ODER (≥ 50 Mio. € Umsatz UND ≥ 43 Mio. € Bilanzsumme)
 * - wE (important): ≥ 50 MA ODER (≥ 10 Mio. € Umsatz UND ≥ 10 Mio. € Bilanzsumme)
 */
const NIS2_SCORING_RULES = {
  essentialEntity: {
    employeeThreshold: 250,
    revenueThresholdEurMillion: 50,
    balanceSheetThresholdEurMillion: 43,
  },
  importantEntity: {
    employeeThreshold: 50,
    revenueThresholdEurMillion: 10,
    balanceSheetThresholdEurMillion: 10,
  },
};

const DEFAULT_QUESTIONNAIRE = {
  version: '1.0',
  title: 'NIS-2 applicability questionnaire',
  questions: [
    { key: 'sector', label: 'NIS-2 sector or subsector', type: 'string', required: true },
    { key: 'employeeCount', label: 'Employee count', type: 'number', required: true },
    { key: 'annualRevenueMillionEur', label: 'Annual revenue in million EUR', type: 'number', required: true },
    { key: 'criticalService', label: 'Provides essential or important service', type: 'boolean', required: true },
    { key: 'crossBorderService', label: 'Provides cross-border services', type: 'boolean', required: false },
  ],
  scoringRules: NIS2_SCORING_RULES,
};

export interface CreateApplicabilityAssessmentData {
  organizationUnitId?: string;
  questionnaireVersion?: string;
  answers: Record<string, unknown>;
  justification?: string;
}

export interface RegistrationData {
  assessmentId?: string;
  entityType: string;
  registrationDate?: Date;
  deadline: Date;
  contactPerson?: string;
  contactDetails?: string;
  submittedData?: Record<string, unknown>;
  submissionProof?: string;
  bsiConfirmation?: string;
}

export interface Nis2QuestionnaireSummary {
  id: string;
  version: string;
  title: string;
  questions: unknown;
  effectiveFrom: Date;
}

const assessmentListSelect = {
  id: true, organizationUnitId: true, questionnaireVersion: true, preliminaryResult: true,
  result: true, justification: true, status: true, submittedForApprovalAt: true,
  approvedAt: true, createdAt: true, updatedAt: true,
};

const registrationListSelect = {
  id: true, assessmentId: true, entityType: true, registrationDate: true, deadline: true,
  contactPerson: true, contactDetails: true, submissionProof: true, bsiConfirmation: true,
  status: true, createdAt: true, updatedAt: true,
};

export class Nis2Service {
  async listActiveQuestionnaires(): Promise<Nis2QuestionnaireSummary[]> {
    return (prisma as any).nis2QuestionnaireVersion.findMany({
      where: { status: 'active', effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] },
      select: { id: true, version: true, title: true, questions: true, effectiveFrom: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async listAssessments() {
    return (prisma as any).nis2Assessment.findMany({ where: { isArchived: false }, select: assessmentListSelect, orderBy: { updatedAt: 'desc' } });
  }

  async getAssessment(id: string) {
    const assessment = await (prisma as any).nis2Assessment.findFirst({ where: { id, isArchived: false } });
    if (!assessment) throw new AppError('NIS-2 assessment not found', 404);
    return assessment;
  }

  async listRegistrations() {
    return (prisma as any).nis2Registration.findMany({ where: { isArchived: false }, select: registrationListSelect, orderBy: { updatedAt: 'desc' } });
  }

  async getRegistration(id: string) {
    const registration = await (prisma as any).nis2Registration.findFirst({
      where: { id, isArchived: false },
      include: { assessment: { select: { id: true, organizationUnitId: true, questionnaireVersion: true, result: true, status: true } }, changes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!registration) throw new AppError('NIS-2 registration not found', 404);
    return registration;
  }

  async ensureDefaultQuestionnaire(createdBy?: string) {
    return (prisma as any).nis2QuestionnaireVersion.upsert({
      where: { version: DEFAULT_QUESTIONNAIRE.version },
      update: { status: 'active' },
      create: { ...DEFAULT_QUESTIONNAIRE, createdBy },
    });
  }

  async createQuestionnaireVersion(data: { version: string; title: string; questions: unknown; scoringRules: unknown; effectiveFrom?: Date }, createdBy?: string) {
    const created = await (prisma as any).nis2QuestionnaireVersion.create({ data: { ...data, createdBy } });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'NIS2_QUESTIONNAIRE_VERSION_CREATE', entityType: 'Nis2QuestionnaireVersion', entityId: created.id, details: `Created NIS-2 questionnaire ${data.version}` });
    return created;
  }

  /**
   * Evaluates NIS2 applicability based on NIS2UmsuCG thresholds:
   * - bwE (essential_entity): ≥ 250 employees OR (≥ €50M revenue AND ≥ €43M balance sheet)
   * - wE (important_entity): ≥ 50 employees OR (≥ €10M revenue AND ≥ €10M balance sheet)
   */
  private evaluateApplicability(answers: Record<string, any>) {
    const employees = Number(answers.employeeCount ?? 0);
    const revenue = Number(answers.annualRevenueMillionEur ?? 0);
    const balanceSheet = Number(answers.balanceSheetMillionEur ?? 0);
    const criticalService = answers.criticalService === true;
    const sector = answers.sector ?? 'unknown';

    // Check essential entity (bwE) thresholds
    const meetsEssentialEmployee = employees >= NIS2_SCORING_RULES.essentialEntity.employeeThreshold;
    const meetsEssentialFinancial = revenue >= NIS2_SCORING_RULES.essentialEntity.revenueThresholdEurMillion
      && balanceSheet >= NIS2_SCORING_RULES.essentialEntity.balanceSheetThresholdEurMillion;
    if (criticalService && (meetsEssentialEmployee || meetsEssentialFinancial)) {
      const reasons: string[] = [];
      if (meetsEssentialEmployee) reasons.push(`${employees} employees (≥ ${NIS2_SCORING_RULES.essentialEntity.employeeThreshold})`);
      if (meetsEssentialFinancial) reasons.push(`€${revenue}M revenue + €${balanceSheet}M balance sheet (threshold: €${NIS2_SCORING_RULES.essentialEntity.revenueThresholdEurMillion}M + €${NIS2_SCORING_RULES.essentialEntity.balanceSheetThresholdEurMillion}M)`);
      return {
        result: 'essential_entity',
        justification: `Sector: ${sector}. Meets essential entity thresholds: ${reasons.join(' and ')}.`,
        sector,
        employees,
        revenue,
        balanceSheet,
      };
    }

    // Check important entity (wE) thresholds
    const meetsImportantEmployee = employees >= NIS2_SCORING_RULES.importantEntity.employeeThreshold;
    const meetsImportantFinancial = revenue >= NIS2_SCORING_RULES.importantEntity.revenueThresholdEurMillion
      && balanceSheet >= NIS2_SCORING_RULES.importantEntity.balanceSheetThresholdEurMillion;
    if (criticalService || meetsImportantEmployee || meetsImportantFinancial) {
      const reasons: string[] = [];
      if (criticalService) reasons.push('critical service provider');
      if (meetsImportantEmployee) reasons.push(`${employees} employees (≥ ${NIS2_SCORING_RULES.importantEntity.employeeThreshold})`);
      if (meetsImportantFinancial) reasons.push(`€${revenue}M revenue + €${balanceSheet}M balance sheet (threshold: €${NIS2_SCORING_RULES.importantEntity.revenueThresholdEurMillion}M + €${NIS2_SCORING_RULES.importantEntity.balanceSheetThresholdEurMillion}M)`);
      return {
        result: 'important_entity',
        justification: `Sector: ${sector}. Meets important entity criteria: ${reasons.join(' and ')}.`,
        sector,
        employees,
        revenue,
        balanceSheet,
      };
    }

    return {
      result: 'not_in_scope',
      justification: `Sector: ${sector}. Provided answers do not meet configured NIS-2 thresholds (employees: ${employees}, revenue: €${revenue}M, balance sheet: €${balanceSheet}M).`,
      sector,
      employees,
      revenue,
      balanceSheet,
    };
  }

  async createApplicabilityAssessment(data: CreateApplicabilityAssessmentData, createdBy?: string) {
    const questionnaireVersion = data.questionnaireVersion ?? DEFAULT_QUESTIONNAIRE.version;
    const questionnaire = await (prisma as any).nis2QuestionnaireVersion.findUnique({ where: { version: questionnaireVersion } }) ?? await this.ensureDefaultQuestionnaire(createdBy);
    const preliminary = this.evaluateApplicability(data.answers);
    const assessment = await (prisma as any).nis2Assessment.create({
      data: {
        organizationUnitId: data.organizationUnitId,
        assessmentType: 'applicability',
        questionnaireVersion: questionnaire.version,
        answers: data.answers,
        preliminaryResult: preliminary.result,
        preliminaryJustification: preliminary.justification,
        result: preliminary.result,
        justification: data.justification ?? preliminary.justification,
        status: 'draft',
        createdBy,
      },
    });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'NIS2_ASSESSMENT_CREATE', entityType: 'Nis2Assessment', entityId: assessment.id, details: `Created NIS-2 assessment ${questionnaire.version}`, newValue: { preliminaryResult: preliminary.result } });
    return assessment;
  }

  async submitAssessment(id: string, userId: string) {
    const existing = await (prisma as any).nis2Assessment.findUnique({ where: { id } });
    if (!existing) throw new AppError('NIS-2 assessment not found', 404);
    if (existing.status === 'approved') throw new AppError('Approved NIS-2 assessment is immutable', 409);
    const updated = await (prisma as any).nis2Assessment.update({ where: { id }, data: { status: 'under_review', submittedForApprovalAt: new Date(), submittedForApprovalBy: userId, updatedBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'NIS2_ASSESSMENT_SUBMIT', entityType: 'Nis2Assessment', entityId: id, details: 'Submitted NIS-2 assessment for professional approval' });
    return updated;
  }

  async approveAssessment(id: string, approverId: string, result?: string, justification?: string) {
    const existing = await (prisma as any).nis2Assessment.findUnique({ where: { id } });
    if (!existing) throw new AppError('NIS-2 assessment not found', 404);
    if (existing.status !== 'under_review') throw new AppError('NIS-2 assessment must be under review before approval', 400);
    const updated = await (prisma as any).nis2Assessment.update({ where: { id }, data: { status: 'approved', result: result ?? existing.result, justification: justification ?? existing.justification, approvedBy: approverId, approvedAt: new Date(), updatedBy: approverId } });
    await auditService.logEventStandalone(prisma, { userId: approverId, action: 'NIS2_ASSESSMENT_APPROVE', entityType: 'Nis2Assessment', entityId: id, details: 'Professionally approved NIS-2 applicability assessment' });
    return updated;
  }

  async createRegistration(data: RegistrationData, createdBy?: string) {
    if (data.assessmentId) {
      const assessment = await (prisma as any).nis2Assessment.findUnique({ where: { id: data.assessmentId } });
      if (!assessment) throw new AppError('NIS-2 assessment not found', 404);
      if (assessment.status !== 'approved') throw new AppError('Registration requires approved NIS-2 applicability assessment', 400);
    }
    const registration = await (prisma as any).nis2Registration.create({ data: { ...data, status: data.submissionProof ? 'submitted' : 'pending', createdBy } });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'NIS2_REGISTRATION_CREATE', entityType: 'Nis2Registration', entityId: registration.id, details: 'Created NIS-2 registration with deadline and submission proof state' });
    return registration;
  }

  async recordRegistrationChange(registrationId: string, data: { changeType: string; description: string; changedData: Record<string, unknown>; notificationDeadline?: Date; submittedAt?: Date; submissionProof?: string }, createdBy?: string) {
    const registration = await (prisma as any).nis2Registration.findUnique({ where: { id: registrationId } });
    if (!registration) throw new AppError('NIS-2 registration not found', 404);
    const change = await (prisma as any).nis2RegistrationChange.create({ data: { registrationId, ...data, status: data.submissionProof ? 'submitted' : 'draft', createdBy } });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'NIS2_REGISTRATION_CHANGE', entityType: 'Nis2Registration', entityId: registrationId, details: `Recorded registration change: ${data.changeType}`, newValue: data.changedData as any });
    return change;
  }

  async ensureMeasuresCatalogue(createdBy?: string) {
    const frameworkVersion = await (prisma as any).$transaction(async (tx: any) => {
      const framework = await tx.framework.upsert({
        where: { code: 'NIS2' },
        update: { name: 'NIS-2', version: '2024-phase5', publisher: 'EU / national implementation', updatedBy: createdBy },
        create: { name: 'NIS-2', code: 'NIS2', version: '2024-phase5', description: 'NIS-2 cybersecurity risk-management measures', publisher: 'EU / national implementation', licenseInfo: 'Internal regulatory mapping, no proprietary catalogue text', createdBy },
      });
      const existing = await tx.frameworkVersion.findFirst?.({ where: { frameworkId: framework.id, version: '2024-phase5' }, include: { requirements: true } });
      if (existing) return existing;
      return tx.frameworkVersion.create({
        data: {
          frameworkId: framework.id,
          version: '2024-phase5',
          source: 'NIS-2 Article 21 implementation mapping',
          licenseInfo: 'Internal regulatory mapping, no proprietary catalogue text',
          createdBy,
          requirements: { create: NIS2_TOPICS.map((topic, index) => ({ requirementKey: `NIS2-21-${index + 1}`, title: topic.title, requirementText: `Maintain appropriate and proportionate measures for ${topic.title}.`, section: 'Article 21', clauseNumber: `${index + 1}`, sortOrder: index + 1, licenseNotice: 'Internal regulatory mapping' })) },
        },
        include: { requirements: true },
      });
    });

    const controls = [];
    for (const requirement of frameworkVersion.requirements) {
      const existingControl = await (prisma as any).control.findFirst({ where: { catalogId: 'NIS2', catalogVersion: '2024-phase5', title: requirement.title } });
      const control = existingControl
        ? await (prisma as any).control.update({ where: { id: existingControl.id }, data: { applicability: 'applicable', applicabilityJustification: 'NIS-2 baseline topic applicable to scoped NIS-2 entity', implementationStatus: existingControl.implementationStatus ?? 'planned', updatedBy: createdBy } })
        : await (prisma as any).control.create({ data: { catalogId: 'NIS2', catalogVersion: '2024-phase5', title: requirement.title, description: requirement.requirementText, controlGoal: `Implement and maintain ${requirement.title}`, applicability: 'applicable', applicabilityJustification: 'NIS-2 baseline topic applicable to scoped NIS-2 entity', implementationStatus: 'planned', maturityLevel: 0, createdBy } });
      await (prisma as any).controlRequirementMapping.createMany({ data: [{ controlId: control.id, requirementId: requirement.id, mappingType: 'fully_fulfills', coverage: 'full', justification: 'Phase 5 NIS-2 measures catalogue mapping', createdBy }], skipDuplicates: true });
      controls.push(control);
    }
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'NIS2_MEASURES_CATALOGUE_ENSURE', entityType: 'FrameworkVersion', entityId: frameworkVersion.id, details: 'Ensured ten NIS-2 topic areas as requirements and controls', newValue: { topics: NIS2_TOPICS.map((topic) => topic.key) } });
    return { frameworkVersion, controls, topics: NIS2_TOPICS };
  }

  /**
   * GET /nis2/sectors
   * Returns the static list of 18 NIS2 sectors for the self-assessment selector.
   */
  async listSectors() {
    return NIS2_SECTORS;
  }

  /**
   * GET /nis2/questionnaire/v2
   * Returns the v2.0 applicability questionnaire with sector options and scoring rules.
   */
  async getQuestionnaireV2() {
    return NIS2_APPLICABILITY_QUESTIONNAIRE;
  }

  /**
   * Seeds the v2.0 questionnaire into the database (idempotent).
   */
  async ensureV2Questionnaire(createdBy?: string) {
    return (prisma as any).nis2QuestionnaireVersion.upsert({
      where: { version: NIS2_APPLICABILITY_QUESTIONNAIRE.version },
      update: { status: 'active' },
      create: { ...NIS2_APPLICABILITY_QUESTIONNAIRE, createdBy },
    });
  }
}

export const nis2Service = new Nis2Service();
