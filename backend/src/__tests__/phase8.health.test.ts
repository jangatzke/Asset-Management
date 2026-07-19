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

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    
    // Reset health state
    setReady(false);
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
      
      await healthReady(mockReq, mockRes);

      // status(200) is called explicitly in the implementation
      expect(mockRes.status).toHaveBeenCalledWith(200);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('ready');
      expect(callArgs.ready).toBe(true);
    });

    test('should return not_ready when server is not ready', async () => {
      setReady(false);
      
      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.status).toBe('not_ready');
      expect(callArgs.ready).toBe(false);
    });

    test('should return not_ready when database is unhealthy', async () => {
      setReady(true);
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      
      await healthReady(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.checks.database.status).toBe('unhealthy');
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
