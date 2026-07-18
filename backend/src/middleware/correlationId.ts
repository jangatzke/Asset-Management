import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation-ID Middleware
 * Generates a unique correlation ID for each request and attaches it to the response.
 * If a correlation ID is already present in the request headers, it is preserved.
 */
export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  // Use existing correlation ID if present
  const existingId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
  
  if (existingId) {
    res.setHeader('X-Correlation-Id', existingId);
    (req as Request & { correlationId: string }).correlationId = existingId;
  } else {
    // Generate new correlation ID
    const id = uuidv4();
    res.setHeader('X-Correlation-Id', id);
    (req as Request & { correlationId: string }).correlationId = id;
  }

  next();
};

/**
 * Get the correlation ID from the request.
 */
export const getCorrelationId = (req: Request): string => {
  return (req as Request & { correlationId: string }).correlationId || '';
};
