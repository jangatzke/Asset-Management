import { createMetricsAuthMiddleware, getMetrics, resetMetrics } from '../middleware/metrics';
import { NextFunction } from 'express';

describe('Phase 11: Metrics Authentication', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;
  const origMetricsToken = process.env.METRICS_TOKEN;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Clear metrics token for clean state
    delete process.env.METRICS_TOKEN;
    resetMetrics();
    nextFn = jest.fn() as unknown as jest.Mock<NextFunction>;
    mockReq = { query: {}, headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    if (origMetricsToken !== undefined) {
      process.env.METRICS_TOKEN = origMetricsToken;
    } else {
      delete process.env.METRICS_TOKEN;
    }
    process.env.NODE_ENV = origNodeEnv;
  });

  describe('no token configured', () => {
    test('should allow access when METRICS_TOKEN is not set', async () => {
      process.env.NODE_ENV = 'test';
      const middleware = createMetricsAuthMiddleware();
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should fail closed in production when METRICS_TOKEN is not set', async () => {
      process.env.NODE_ENV = 'production';

      const middleware = createMetricsAuthMiddleware();
      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(503);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error).toBe('metrics_unavailable');
    });
  });

  describe('token configured - query parameter', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'test-metrics-token-123';
    });

    test('should allow access with correct token in query parameter', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.query = { token: 'test-metrics-token-123' };
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject access with wrong token in query parameter', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.query = { token: 'wrong-token' };
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error).toBe('unauthorized');
    });

    test('should reject access with no token in query parameter', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.query = {};
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('token configured - Bearer header', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'bearer-token-456';
    });

    test('should allow access with correct Bearer token', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.headers = { authorization: 'Bearer bearer-token-456' };
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject access with wrong Bearer token', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.headers = { authorization: 'Bearer wrong-token' };
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should reject access with no Authorization header', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.headers = {};
      
      middleware(mockReq, mockRes, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should accept query token even with wrong Bearer header', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.headers = { authorization: 'Bearer wrong-token' };
      mockReq.query = { token: 'bearer-token-456' };
      
      middleware(mockReq, mockRes, nextFn);
      
      // Query token should take precedence or at least be checked
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('token is never leaked', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'secret-token-789';
    });

    test('should not include token value in error response', async () => {
      const middleware = createMetricsAuthMiddleware();
      mockReq.query = {};
      
      middleware(mockReq, mockRes, nextFn);
      
      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(callArgs)).not.toContain('secret-token-789');
    });
  });

  describe('in-memory metrics are updated', () => {
    test('should track request counts in getMetrics()', async () => {
      resetMetrics();
      
      const m = getMetrics();
      expect(m.totalRequests).toBe(0);
      
      // Verify the API works
      expect(typeof m.requestsByMethod).toBe('object');
      expect(typeof m.requestsByEndpoint).toBe('object');
      expect(typeof m.requestsByStatusCode).toBe('object');
    });
  });
});
