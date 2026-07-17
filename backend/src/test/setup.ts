// Test setup file - runs before each test file
import { jest, beforeEach, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Mock Prisma client - reset before each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  // Any global cleanup can go here
});
