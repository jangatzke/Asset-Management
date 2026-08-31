/**
 * Prisma Client Mock for Testing
 *
 * This file provides a mock implementation of the Prisma client that can be
 * used in unit tests to avoid connecting to a real database.
 *
 * Usage:
 *   import { createMockPrismaClient } from './test/prisma-mock';
 *   const mockClient = createMockPrismaClient();
 *   // Then use mockClient.user.findUnique.mockResolvedValue(...)
 */

import { jest } from '@jest/globals';

type MockFunction = ReturnType<typeof jest.fn>;
type MockModel = {
  findUnique: MockFunction;
  findFirst: MockFunction;
  findMany: MockFunction;
  create: MockFunction;
  createMany: MockFunction;
  update: MockFunction;
  updateMany: MockFunction;
  delete: MockFunction;
  deleteMany: MockFunction;
  upsert: MockFunction;
  count: MockFunction;
};

export type MockPrismaClient = {
  [model: string]: any;
  $connect: MockFunction;
  $disconnect: MockFunction;
  $transaction: MockFunction;
};

// Create a mock structure matching PrismaClient
export const createMockPrismaClient = (): MockPrismaClient => {
  const createMockModel = (): MockModel => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  });

  return {
    // Core identity & access models
    user: createMockModel(),
    userRole: createMockModel(),
    userGroup: createMockModel(),
    group: createMockModel(),
    groupRole: createMockModel(),
    role: createMockModel(),
    oidcConfig: createMockModel(),
    oidcLoginState: createMockModel(),
    oidcAccountLink: createMockModel(),
    authSettings: createMockModel(),
    passwordHistory: createMockModel(),

    // Organization models
    organizationUnit: createMockModel(),
    site: createMockModel(),

    // ISMS models
    ismsScope: createMockModel(),
    interestedParty: createMockModel(),

    // Asset models
    asset: createMockModel(),
    assetType: createMockModel(),
    assetSubtype: createMockModel(),
    assetRelation: createMockModel(),


    // ITIL ticket / e-mail gateway models
    ticket: createMockModel(),
    ticketAsset: createMockModel(),
    ticketComment: createMockModel(),
    ticketHistoryEntry: createMockModel(),
    ticketEscalation: createMockModel(),
    ticketLink: createMockModel(),
    ticketTypeConfig: createMockModel(),
    emailGatewayConfig: createMockModel(),
    emailMessage: createMockModel(),
    // Risk models
    riskMethod: createMockModel(),
    risk: createMockModel(),
    riskTreatment: createMockModel(),
    riskAssessmentVersion: createMockModel(),
    riskControl: createMockModel(),
    riskControlAssessment: createMockModel(),
    riskMethodVersion: createMockModel(),
    riskScenario: createMockModel(),
    riskCause: createMockModel(),
    riskImpact: createMockModel(),
    riskCauseLink: createMockModel(),
    riskImpactLink: createMockModel(),
    reviewTask: createMockModel(),
    threat: createMockModel(),
    vulnerability: createMockModel(),

    // Document & Evidence models
    document: createMockModel(),
    evidence: createMockModel(),
    evidenceLink: createMockModel(),

    // Framework & Control models
    framework: createMockModel(),
    frameworkVersion: createMockModel(),
    requirement: createMockModel(),
    controlRequirementMapping: createMockModel(),
    control: createMockModel(),
    controlImplementation: createMockModel(),
    controlTest: createMockModel(),
    controlImplementationRequirement: createMockModel(),
    controlFinding: createMockModel(),
    controlAction: createMockModel(),
    statementOfApplicability: createMockModel(),
    soAItem: createMockModel(),
    soAApproval: createMockModel(),

    // Incident models
    incident: createMockModel(),
    incidentAssessment: createMockModel(),
    notificationDeadline: createMockModel(),
    incidentHistoryEntry: createMockModel(),
    entityHistoryEntry: createMockModel(),
    nis2IncidentSignificanceRuleVersion: createMockModel(),

    // Audit & Compliance models
    auditLog: createMockModel(),
    policyDocument: createMockModel(),
    documentVersion: createMockModel(),
    documentAcknowledgement: createMockModel(),
    documentReview: createMockModel(),
    supplier: createMockModel(),
    supplierAssessment: createMockModel(),
    supplierContractRelation: createMockModel(),
    supplierRiskRelation: createMockModel(),
    businessImpactAnalysis: createMockModel(),
    bIAAssetRelation: createMockModel(),
    businessContinuityPlan: createMockModel(),
    bCPExercise: createMockModel(),
    audit: createMockModel(),
    auditProgram: createMockModel(),
    auditPlan: createMockModel(),
    auditFinding: createMockModel(),
    auditEvidenceRelation: createMockModel(),
    correctiveAction: createMockModel(),
    training: createMockModel(),
    trainingCourse: createMockModel(),
    trainingAssignment: createMockModel(),
    trainingCompletion: createMockModel(),
    trainingAcknowledgement: createMockModel(),
    managementReview: createMockModel(),
    managementReviewAction: createMockModel(),
    securityObjective: createMockModel(),
    metricDefinition: createMockModel(),
    metricValue: createMockModel(),

    // NIS2 models
    nis2Assessment: createMockModel(),
    nis2Registration: createMockModel(),

    // Workflow models
    workflow: createMockModel(),
    workflowDefinition: createMockModel(),
    workflowInstance: createMockModel(),
    workflowTask: createMockModel(),
    workflowTransitionLog: createMockModel(),
    reportDefinition: createMockModel(),
    reportRun: createMockModel(),
    exportJob: createMockModel(),

    // Session & Auth models
    session: createMockModel(),
    refreshToken: createMockModel(),

    // Intune models
    intuneDeviceSync: createMockModel(),
    intuneDetectedApp: createMockModel(),
    intuneSyncStatus: createMockModel(),
    intuneSyncConfig: createMockModel(),
    intuneAppCredentials: createMockModel(),
    integrationSource: createMockModel(),
    importRun: createMockModel(),
    importRecord: createMockModel(),
    fieldLock: createMockModel(),
    fieldProvenance: createMockModel(),
    sourcePriority: createMockModel(),

    // ISO 27001 new models
    contract: createMockModel(),
    license: createMockModel(),
    businessProcess: createMockModel(),
    assetDocument: createMockModel(),
    riskEvidence: createMockModel(),
    riskAsset: createMockModel(),
    riskProcess: createMockModel(),
    riskService: createMockModel(),
    treatmentAction: createMockModel(),
    vulnerabilityAsset: createMockModel(),
    incidentAsset: createMockModel(),
    assetLifecycleLog: createMockModel(),

    // Junction tables for M:N relations (Paket 2.2)
    networkAddress: createMockModel(),
    assetProcess: createMockModel(),
    assetService: createMockModel(),
    assetContract: createMockModel(),
    assetLicense: createMockModel(),
    displayIdCounter: createMockModel(),
    fiscalYearConfig: createMockModel(),
    costPlan: createMockModel(),
    costPlanItem: createMockModel(),

    // VMware models
    vmwareCredential: createMockModel(),
    vCenterServer: createMockModel(),

    // Proxmox models
    proxmoxCredential: createMockModel(),
    proxmoxServer: createMockModel(),

    // Prisma internal methods
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };
};
