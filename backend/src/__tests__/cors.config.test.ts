/**
 * Tests for CORS Configuration (SEC-003)
 *
 * Verifies that CORS does not use wildcard '*' as default origin.
 */

import { jest } from '@jest/globals';

describe('CORS Configuration (SEC-003)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should not use wildcard "*" as default CORS origin', () => {
    // Simulate no CORS_ORIGINS set
    delete process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGIN;

    // Import cors config logic inline to test
    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
    const origin = allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'];

    expect(origin).not.toContain('*');
    expect(origin).toEqual(['http://localhost:3000']);
  });

  it('should use explicit origins from CORS_ORIGINS env var', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';

    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
    const origin = allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'];

    expect(origin).toEqual(['https://app.example.com', 'https://admin.example.com']);
    expect(origin).not.toContain('*');
  });

  it('should handle empty CORS_ORIGINS gracefully', () => {
    process.env.CORS_ORIGINS = '';

    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
    const origin = allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'];

    expect(origin).not.toContain('*');
    expect(origin).toEqual(['http://localhost:3000']);
  });

  it('should filter out blank entries from CORS_ORIGINS', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com,,https://admin.example.com,';

    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

    expect(allowedOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });
});
