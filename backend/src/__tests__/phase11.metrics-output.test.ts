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
      path: '/api/v1/assets',
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

    test('should track requests by endpoint (classified)', async () => {
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(mockReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      // Should use classified endpoint pattern, not raw path
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
      const uuidReq = { ...mockReq, path: '/api/v1/assets/550e8400-e29b-41d4-a716-446655440000' };
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(uuidReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
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

  describe('query string stripping (security fix)', () => {
    test('should strip query parameters from endpoint labels', async () => {
      const queryReq = { ...mockReq, path: '/api/assets?x=1' };
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(queryReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      // Query string should be stripped - no ? in key, unknown routes classified as __unknown__
      expect(m.requestsByEndpoint['__unknown__']).toBe(1);
      expect(m.requestsByEndpoint['/api/assets?x=1']).toBeUndefined();
      expect(Object.keys(m.requestsByEndpoint).every(k => !k.includes('?'))).toBe(true);
    });

    test('should strip hash fragments from endpoint labels', async () => {
      const hashReq = { ...mockReq, path: '/api/assets#section' };
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(hashReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      // Hash should be stripped, unknown route classified as __unknown__
      expect(m.requestsByEndpoint['__unknown__']).toBe(1);
      expect(m.requestsByEndpoint['/api/assets#section']).toBeUndefined();
      expect(Object.keys(m.requestsByEndpoint).every(k => !k.includes('#'))).toBe(true);
    });

    test('should not leak token values in endpoint labels', async () => {
      resetMetrics(); // Start fresh for this specific security check
      const tokenReq = { ...mockReq, path: '/some/unrecognized/path?token=supersecrettoken123' };
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(tokenReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      const allEndpoints = Object.keys(m.requestsByEndpoint);
      // No endpoint key should contain the secret token or token= pattern
      for (const endpoint of allEndpoints) {
        expect(endpoint).not.toContain('supersecrettoken123');
        expect(endpoint).not.toContain('token=');
      }
      // Unknown route should be classified as __unknown__
      expect(m.requestsByEndpoint['__unknown__']).toBe(1);
    });
  });

  describe('route classification (cardinality fix)', () => {
    test('should classify unknown routes as __unknown__', async () => {
      const unknownReq = { ...mockReq, path: '/some/unrecognized/path' };
      (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'finish') setImmediate(() => cb());
      });

      metricsMiddleware(unknownReq as Request, mockRes as Response, jest.fn() as NextFunction);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const m = getMetrics();
      expect(m.requestsByEndpoint['__unknown__']).toBe(1);
    });

    test('should group multiple unknown routes under __unknown__', async () => {
      const paths = [
        '/random/path1',
        '/another/path2',
        '/api/v1/unknown/endpoint',
        '/anything/else',
      ];

      for (const path of paths) {
        const testReq = { ...mockReq, path };
        (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
          if (event === 'finish') setImmediate(() => cb());
        });

        metricsMiddleware(
          testReq as Request,
          mockRes as Response,
          jest.fn() as NextFunction
        );
        await new Promise(resolve => setImmediate(resolve));
      }
      
      const m = getMetrics();
      expect(m.requestsByEndpoint['__unknown__']).toBe(4);
    });

    test('should classify known routes correctly', async () => {
      const knownRoutes = [
        '/api/v1/assets',
        '/api/v1/risks',
        '/api/v1/controls',
        '/api/v1/incidents',
        '/api/v1/auth/login',
        '/api/v1/users',
        '/api/v1/admin',
        '/api/v1/contracts',
        '/metrics',
        '/health',
        '/health/live',
        '/health/ready',
      ];

      for (const route of knownRoutes) {
        const testReq = { ...mockReq, path: route };
        (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
          if (event === 'finish') setImmediate(() => cb());
        });

        metricsMiddleware(
          testReq as Request,
          mockRes as Response,
          jest.fn() as NextFunction
        );
        await new Promise(resolve => setImmediate(resolve));
      }
      
      const m = getMetrics();
      // All known routes should be tracked individually
      expect(m.requestsByEndpoint['__unknown__']).toBeUndefined();
    });

    test('should prevent cardinality explosion from dynamic query parameters', async () => {
      const queryPaths = [
        '/api/v1/assets?search=abc',
        '/api/v1/assets?search=xyz',
        '/api/v1/assets?filter=status:active',
        '/api/v1/assets?page=1',
        '/api/v1/assets?page=2',
      ];

      for (const path of queryPaths) {
        const testReq = { ...mockReq, path };
        (mockRes as any).on = jest.fn().mockImplementation((event: string, cb: any) => {
          if (event === 'finish') setImmediate(() => cb());
        });

        metricsMiddleware(
          testReq as Request,
          mockRes as Response,
          jest.fn() as NextFunction
        );
        await new Promise(resolve => setImmediate(resolve));
      }
      
      const m = getMetrics();
      // All requests should be grouped under the same classified endpoint (/api/v1/assets matches a known pattern)
      expect(m.requestsByEndpoint['/api/v1/assets']).toBe(5);
      // No query-string-based label values should exist
      expect(Object.keys(m.requestsByEndpoint).every(k => !k.includes('?'))).toBe(true);
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
          { method: 'GET', path: '/api/v1/assets', url: '/api/v1/assets' } as Request,
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
