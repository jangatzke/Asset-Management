import { 
  metricsMiddleware, 
  resetMetrics, 
  getMetrics,
  register,
} from '../middleware/metrics';
import { Request, Response, NextFunction } from 'express';

describe('Phase 11: Metrics Output', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    resetMetrics();
    process.env.NODE_ENV = 'test';
    mockReq = {
      method: 'GET',
      originalUrl: '/api/v1/assets',
      url: '/api/v1/assets',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: true,
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  describe('in-memory metrics tracking', () => {
    test('should track total requests when response finishes', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') {
          setImmediate(() => cb());
        }
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.totalRequests).toBe(1);
    });

    test('should track requests by method', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.requestsByMethod['GET']).toBe(1);
    });

    test('should track requests by endpoint', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.requestsByEndpoint['/api/v1/assets']).toBe(1);
    });

    test('should track errors (4xx)', async () => {
      mockRes.statusCode = 404;
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.errors).toBe(1);
    });

    test('should normalize UUIDs in endpoint paths', async () => {
      mockReq.originalUrl = '/api/v1/assets/550e8400-e29b-41d4-a716-446655440000';
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.requestsByEndpoint['/api/v1/assets/:id']).toBe(1);
    });

    test('should track response time', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      // totalResponseTimeMs should be >= 0 (at least the time spent in setImmediate)
      expect(m.totalResponseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('prom-client metrics registration', () => {
    test('should produce valid Prometheus text output with expected metric families', async () => {
      const output = await register.metrics();
      
      expect(output).toContain('http_requests_total');
      expect(output).toContain('http_request_duration_seconds_bucket');
      expect(output).toContain('http_errors_total');
    });

    test('should include service label in default labels', async () => {
      const output = await register.metrics();
      
      expect(output).toContain('service="asset-management-backend"');
    });

    test('should have correct metric type annotations', async () => {
      const output = await register.metrics();
      
      expect(output).toContain('# HELP http_requests_total');
      expect(output).toContain('# TYPE http_requests_total counter');
      expect(output).toContain('# TYPE http_request_duration_seconds histogram');
      expect(output).toContain('# TYPE http_errors_total counter');
    });
  });

  describe('multiple request tracking', () => {
    test('should accumulate counts across multiple requests without reset', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      // Simulate 3 sequential requests WITHOUT resetting in between
      for (let i = 0; i < 3; i++) {
        metricsMiddleware(
          { method: 'GET', originalUrl: '/api/v1/assets', url: '/api/v1/assets' } as Request,
          mockRes as Response,
          jest.fn() as NextFunction
        );
        await new Promise(resolve => setImmediate(resolve));
      }

      const m = getMetrics();
      expect(m.totalRequests).toBe(3);
    });
  });
});
