import { 
  healthBasic, 
  healthLive, 
  healthReady, 
  setReady, 
  registerHealthCheck,
  getHealthState 
} from '../middleware/health';

// Mock prisma
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

import prisma from '../config/database';

describe('Health Check Middleware', () => {
  let mockReq: any;
  let mockRes: any;

  let origJwtSecret: string | undefined;
  let origDbUrl: string | undefined;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };
    // Reset mock state to prevent bleeding from other test files that also mock prisma
    (prisma.$queryRaw as jest.Mock).mockReset();
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    
    // Set required env vars so secrets check passes by default
    origJwtSecret = process.env.JWT_SECRET;
    origDbUrl = process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'test-jwt-secret-for-phase8';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    // Reset health state
    setReady(false);
  });

  afterEach(() => {
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
  });

  describe('healthLive', () => {
    test('should return ok status with uptime', async () => {
      await healthLive(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      }));
    });
  });

  describe('healthReady', () => {
    test('should return ready when database is connected and server is ready', async () => {
      setReady(true);
      
      // Mock all $queryRaw calls: DB check, schema latest migration row, no pending migrations
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ "?column?": 1 }]) // DB check
        .mockResolvedValueOnce([]) // schema check - fresh/no rows → healthy
        .mockResolvedValueOnce([]); // no pending

      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('healthy');
      expect(callArgs.ready).toBe(true);
    });

    test('should return not_ready when server is not ready', async () => {
      setReady(false);
      
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ "?column?": 1 }]) // DB check
        .mockResolvedValueOnce([]) // schema check - fresh/no rows → healthy
        .mockResolvedValueOnce([]); // no pending

      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.ready).toBe(false);
    });

    test('should return not_ready when database is unhealthy', async () => {
      setReady(true);
      // DB check fails, so schema/pending queries are never reached
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      
      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.database.status).toBe('unhealthy');
      // Secrets check should still pass since env vars are set in beforeEach
      expect(callArgs.checks.secrets.status).toBe('healthy');
    });
  });

  describe('healthBasic', () => {
    test('should return ok when database is connected', async () => {
      await healthBasic(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
      }));
    });

    test('should return degraded when database connection fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      
      await healthBasic(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('degraded');
    });
  });

  describe('registerHealthCheck', () => {
    test('should register a health check function', async () => {
      const mockCheck = jest.fn().mockResolvedValue(true);
      registerHealthCheck('test-check', mockCheck);

      // Wait for the async check to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockCheck).toHaveBeenCalled();
      
      const state = getHealthState();
      expect(state.checks['test-check']).toBe(true);
    });

    test('should mark check as unhealthy if it fails', async () => {
      const mockCheck = jest.fn().mockRejectedValue(new Error('check failed'));
      registerHealthCheck('failing-check', mockCheck);

      await new Promise(resolve => setTimeout(resolve, 50));
      
      const state = getHealthState();
      expect(state.checks['failing-check']).toBe(false);
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
});
