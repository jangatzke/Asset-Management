import { Request, Response } from 'express';
import { correlationId as correlationIdMiddleware, getCorrelationId, CORRELATION_ID_HEADER } from '../middleware/correlationId';

describe('Correlation-ID Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    nextFn = jest.fn();
    mockReq = { headers: {}, method: 'GET', url: '/test' };
    const headers: Record<string, string> = {};
    mockRes = { 
      getHeader: jest.fn(((key: string) => headers[key.toLowerCase()]) as Response['getHeader']),
      setHeader: jest.fn(((key: string, value: string | number | readonly string[]) => {
        headers[key.toLowerCase()] = String(value);
        return mockRes;
      }) as Response['setHeader']),
    } as Partial<Response>;
  });

  test('should generate a new correlation ID if not present', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, nextFn as any);

    expect(nextFn).toHaveBeenCalled();
    // Express normalizes header names - check that setHeader was called with UUID format
    const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls as Array<[string, string]>;
    const idSet = setHeaderCalls.find(c => c[0].toLowerCase() === 'x-correlation-id');
    expect(idSet).toBeDefined();
    expect(idSet![1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(getCorrelationId(mockReq as Request)).toBe(idSet![1]);
  });

  test('should preserve existing correlation ID from request header', () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    mockReq.headers = { [CORRELATION_ID_HEADER.toLowerCase()]: existingId };

    correlationIdMiddleware(mockReq as Request, mockRes as Response, nextFn as any);

    expect(nextFn).toHaveBeenCalled();
    const setHeaderCalls = (mockRes.setHeader as jest.Mock).mock.calls as Array<[string, string]>;
    const idSet = setHeaderCalls.find(c => c[0].toLowerCase() === 'x-correlation-id');
    expect(idSet).toBeDefined();
    expect(idSet![1]).toBe(existingId);
    expect(getCorrelationId(mockReq as Request)).toBe(existingId);
  });

  test('getCorrelationId should return empty string if not set', () => {
    mockReq = {};
    expect(getCorrelationId(mockReq as Request)).toBe('');
  });
});
