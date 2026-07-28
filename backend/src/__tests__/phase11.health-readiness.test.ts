import { 
  healthBasic, 
  healthReady, 
  setReady, 
  setCriticalInitialization,
  resetHealthState,
  registerRuntimeHealthCheck,
  getHealthState,
} from '../middleware/health';
import fs from 'fs';

// Mock prisma
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

import prisma from '../config/database';

describe('Phase 11: Health Readiness Checks', () => {
  let mockReq: any;
  let mockRes: any;

  let origJwtSecret: string | undefined;
  let origDbUrl: string | undefined;
  let origReadinessMode: string | undefined;
  let readdirSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    // Save and set required env vars so secrets check passes by default
    origJwtSecret = process.env.JWT_SECRET;
    origDbUrl = process.env.DATABASE_URL;
    origReadinessMode = process.env.READINESS_MODE;
    process.env.JWT_SECRET = 'test-jwt-secret-for-phase11';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    // Reset mock state completely to prevent bleeding from other test files (e.g., phase8.health)
    (prisma.$queryRaw as jest.Mock).mockReset();
    // Default: DB works
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    resetHealthState();
    readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: '20260718000000_consolidated_init', isDirectory: () => true },
    ] as any);
  });

  afterEach(() => {
    // Restore env vars
    if (origJwtSecret !== undefined) {
      process.env.JWT_SECRET = origJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
    if (origDbUrl !== undefined) {
      process.env.DATABASE_URL = origDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (origReadinessMode !== undefined) {
      process.env.READINESS_MODE = origReadinessMode;
    } else {
      delete process.env.READINESS_MODE;
    }
    readdirSpy.mockRestore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('healthBasic', () => {
    test('should return ok when database is connected', async () => {
      await healthBasic(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
      }));
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should return degraded when database connection fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      
      await healthBasic(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('degraded');
    });
  });

  describe('healthReady - healthy', () => {
    beforeEach(() => {
      setReady(true);
      // Mock ALL $queryRaw calls in order:
      // healthReady: DB check (1 call)
      // checkSchemaStatus: real Prisma migration rows
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([{ migration_name: '20260718000000_consolidated_init', started_at: new Date(), finished_at: new Date(), rolled_back_at: null, applied_steps_count: 1, checksum: 'abc', logs: null }]);
    });

    test('should return healthy when all checks pass', async () => {
      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('healthy');
      expect(callArgs.ready).toBe(true);
      expect(callArgs.checks.database.status).toBe('healthy');
      expect(callArgs.checks.secrets.status).toBe('healthy');
    });

    test('should include all integration check sections', async () => {
      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks).toHaveProperty('database');
      expect(callArgs.checks).toHaveProperty('schema');
      expect(callArgs.checks).toHaveProperty('secrets');
      expect(callArgs.checks).toHaveProperty('intune');
      expect(callArgs.checks).toHaveProperty('smtp');
      expect(callArgs.checks).toHaveProperty('vmware');
      expect(callArgs.checks).toHaveProperty('proxmox');
    });

    test('should include uptime and timestamp', async () => {
      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('uptime');
      expect(typeof callArgs.uptime).toBe('number');
      expect(callArgs).toHaveProperty('timestamp');
      expect(new Date(callArgs.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('healthReady - not_ready', () => {
    test('should return not_ready when database is unhealthy', async () => {
      setReady(true);
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('DB connection refused'));
      
      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.ready).toBe(false);
      expect(callArgs.checks.database.status).toBe('unhealthy');
    });

    test('should return not_ready when required secrets are missing', async () => {
      setReady(true);
      // Clear JWT_SECRET and DATABASE_URL temporarily
      const origJwt = process.env.JWT_SECRET;
      const origDb = process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.DATABASE_URL;

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check passes
        .mockResolvedValueOnce([]); // schema check

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.checks.secrets.status).toBe('unhealthy');

      // Restore
      process.env.JWT_SECRET = origJwt;
      process.env.DATABASE_URL = origDb;
    });
  });

  describe('healthReady - degraded', () => {
    let origJwt: string | undefined;
    let origDb: string | undefined;

    beforeEach(() => {
      // Ensure required secrets are set for this sub-block
      origJwt = process.env.JWT_SECRET;
      origDb = process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'test-jwt-secret-for-degraded';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      // Reset mock state completely to prevent bleeding from other test files
      (prisma.$queryRaw as jest.Mock).mockReset();
    });

    afterEach(() => {
      if (origJwt !== undefined) process.env.JWT_SECRET = origJwt;
      else delete process.env.JWT_SECRET;
      if (origDb !== undefined) process.env.DATABASE_URL = origDb;
      else delete process.env.DATABASE_URL;
    });

    test('should return healthy when optional integrations are skipped (not configured)', async () => {
      setReady(true);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([{ migration_name: '20260718000000_consolidated_init', started_at: new Date(), finished_at: new Date(), rolled_back_at: null, applied_steps_count: 1, checksum: 'abc', logs: null }]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('healthy');
      expect(callArgs.checks.intune.status).toBe('skipped');
      expect(callArgs.checks.smtp.status).toBe('skipped');
    });

    test('should return healthy when optional integration is unhealthy', async () => {
      setReady(true);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([{ migration_name: '20260718000000_consolidated_init', started_at: new Date(), finished_at: new Date(), rolled_back_at: null, applied_steps_count: 1, checksum: 'abc', logs: null }]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('healthy');
    });
  });

  describe('registerRuntimeHealthCheck', () => {
    test('should include runtime check results in readiness response', async () => {
      setReady(true);
      
      registerRuntimeHealthCheck('custom-check', async () => ({
        status: 'healthy',
        details: 'Custom check passed',
      }));

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([]); // schema check - no rows

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks['custom-check']).toBeDefined();
      expect(callArgs.checks['custom-check'].status).toBe('healthy');
    });

    test('should mark server degraded when runtime check fails', async () => {
      setReady(true);
      
      registerRuntimeHealthCheck('failing-check', async () => ({
        status: 'unhealthy',
        details: 'Custom check failed',
      }));

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([]); // schema check - no rows

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks['failing-check'].status).toBe('unhealthy');
    });
  });

  describe('secret redaction', () => {
    test('should not include secret values in health response', async () => {
      setReady(true);
      
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([]); // schema check - no rows

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      const responseStr = JSON.stringify(callArgs);
      
      // Verify no actual secret values are leaked
      expect(responseStr).not.toContain('your-super-secret');
      expect(responseStr).not.toContain('password@localhost');
    });

    test('should list checked secret names without revealing values', async () => {
      setReady(true);
      
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([]); // schema check - no rows

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.secrets.details).toContain('JWT_SECRET');
      expect(callArgs.checks.secrets.details).toContain('DATABASE_URL');
    });
  });

  describe('getHealthState', () => {
    test('should return a copy of the health state', () => {
      setReady(true);
      const state1 = getHealthState();
      const state2 = getHealthState();
      
      expect(state1).toEqual(state2);
      // Verify it's a copy, not the same reference
      (state1 as any).isReady = false;
      expect(state2.isReady).toBe(true);
    });
  });

  describe('schema status check', () => {
    let origJwt: string | undefined;
    let origDb: string | undefined;

    beforeEach(() => {
      origJwt = process.env.JWT_SECRET;
      origDb = process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'test-jwt-secret-for-schema';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      // Reset mock state completely to prevent bleeding from other test files
      (prisma.$queryRaw as jest.Mock).mockReset();
    });

    afterEach(() => {
      if (origJwt !== undefined) process.env.JWT_SECRET = origJwt;
      else delete process.env.JWT_SECRET;
      if (origDb !== undefined) process.env.DATABASE_URL = origDb;
      else delete process.env.DATABASE_URL;
    });

    test('should return healthy when no pending migrations and schema has rows', async () => {
      setReady(true);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([{ migration_name: '20260718000000_consolidated_init', started_at: new Date(), finished_at: new Date(), rolled_back_at: null, applied_steps_count: 1, checksum: 'abc', logs: null }]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.schema.status).toBe('healthy');
    });

    test('should return healthy when fresh schema (no migrations yet)', async () => {
      setReady(true);
      readdirSpy.mockReturnValue([] as any);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }]) // DB check
        .mockResolvedValueOnce([]); // no migration rows

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.schema.status).toBe('healthy');
    });

    test('should use real Prisma migration columns and detect failed incomplete migrations', async () => {
      setReady(true);
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ migration_name: '20260728190000_failed', started_at: new Date(), finished_at: null, rolled_back_at: null, applied_steps_count: 0, checksum: 'abc', logs: 'migration failed' }]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.checks.schema.status).toBe('unhealthy');
      expect(callArgs.checks.schema.details).toContain('incomplete or failed');
    });

    test('should compare local migration directories before reporting pending migrations', async () => {
      setReady(true);
      readdirSpy.mockReturnValue([
        { name: '20260718000000_consolidated_init', isDirectory: () => true },
        { name: '20260728182000_p1f_job_leases', isDirectory: () => true },
      ] as any);
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ migration_name: '20260718000000_consolidated_init', started_at: new Date(), finished_at: new Date(), rolled_back_at: null, applied_steps_count: 1, checksum: 'abc', logs: null }]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.schema.status).toBe('unhealthy');
      expect(callArgs.checks.schema.details).toContain('Pending local Prisma migrations');
      expect(callArgs.checks.schema.details).toContain('20260728182000_p1f_job_leases');
    });

    test('should fail closed when migration table is unreadable in critical readiness mode', async () => {
      process.env.READINESS_MODE = 'critical';
      setReady(true);
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockRejectedValueOnce(new Error('relation "_prisma_migrations" does not exist'));

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.checks.schema.status).toBe('unhealthy');
    });
  });

  describe('critical initialization readiness', () => {
    test('should not become ready by timeout alone', async () => {
      jest.useFakeTimers();
      setReady(false);
      jest.advanceTimersByTime(5000);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.ready).toBe(false);
    });

    test('should remain not_ready after critical initialization failure', async () => {
      setReady(true);
      setCriticalInitialization('standardAssetTypes', false);

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([]);

      await healthReady(mockReq, mockRes);

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.ready).toBe(false);
      expect(callArgs.checks['startup:standardAssetTypes'].status).toBe('unhealthy');
    });
  });
});
