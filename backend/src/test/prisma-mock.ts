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

// Create a mock structure matching PrismaClient
export const createMockPrismaClient = () => {
  const createMockModel = () => ({
    findUnique: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    findMany: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
    deleteMany: jest.fn<any>(),
    upsert: jest.fn<any>(),
    count: jest.fn<any>(),
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

    // Organization models
    organizationUnit: createMockModel(),
    site: createMockModel(),

    // ISMS models
    ismsScope: createMockModel(),
    interestedParty: createMockModel(),

    // Asset models
    asset: createMockModel(),
    assetType: createMockModel(),
    assetRelation: createMockModel(),

    // Risk models
    riskMethod: createMockModel(),
    risk: createMockModel(),
    riskTreatment: createMockModel(),
    threat: createMockModel(),
    vulnerability: createMockModel(),

    // Document & Evidence models
    document: createMockModel(),
    evidence: createMockModel(),

    // Framework & Control models
    framework: createMockModel(),
    control: createMockModel(),
    statementOfApplicability: createMockModel(),

    // Incident models
    incident: createMockModel(),
    incidentAssessment: createMockModel(),
    notificationDeadline: createMockModel(),

    // Audit & Compliance models
    auditLog: createMockModel(),
    policyDocument: createMockModel(),
    documentVersion: createMockModel(),
    supplier: createMockModel(),
    businessImpactAnalysis: createMockModel(),
    audit: createMockModel(),
    auditFinding: createMockModel(),
    correctiveAction: createMockModel(),
    training: createMockModel(),
    managementReview: createMockModel(),

    // NIS2 models
    nis2Assessment: createMockModel(),
    nis2Registration: createMockModel(),

    // Workflow models
    workflow: createMockModel(),
    workflowInstance: createMockModel(),

    // Session & Auth models
    session: createMockModel(),
    refreshToken: createMockModel(),

    // Intune models
    intuneDeviceSync: createMockModel(),
    intuneDetectedApp: createMockModel(),
    intuneSyncStatus: createMockModel(),
    intuneSyncConfig: createMockModel(),
    intuneAppCredentials: createMockModel(),

    // ISO 27001 new models
    contract: createMockModel(),
    license: createMockModel(),
    businessProcess: createMockModel(),
    assetDocument: createMockModel(),
    riskEvidence: createMockModel(),
    riskAsset: createMockModel(),
    vulnerabilityAsset: createMockModel(),
    incidentAsset: createMockModel(),
    assetLifecycleLog: createMockModel(),

    // VMware models
    vmwareCredential: createMockModel(),
    vCenterServer: createMockModel(),

    // Proxmox models
    proxmoxCredential: createMockModel(),
    proxmoxServer: createMockModel(),

    // Prisma internal methods
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn<any>(),
  };
};

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
