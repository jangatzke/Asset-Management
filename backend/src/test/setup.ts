// Test setup file - runs before each test file
import { jest, beforeEach, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
// 64-char hex key (256-bit) so credentialEncryption.service does not log a
// FATAL warning at module load time in tests.
process.env.CREDENTIAL_ENCRYPTION_KEY =
  process.env.CREDENTIAL_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock Prisma client - reset before each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  // Any global cleanup can go here
});
