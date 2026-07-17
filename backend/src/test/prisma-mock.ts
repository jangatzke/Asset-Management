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
    user: createMockModel(),
    userRole: createMockModel(),
    userGroup: createMockModel(),
    group: createMockModel(),
    groupRole: createMockModel(),
    role: createMockModel(),
    oidcConfig: createMockModel(),
    asset: createMockModel(),
    assetType: createMockModel(),
    risk: createMockModel(),
    control: createMockModel(),
    incident: createMockModel(),
    auditLog: createMockModel(),
    organizationUnit: createMockModel(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn<any>(),
  };
};

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
