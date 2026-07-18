// Zod-based Request Validation Middleware
// Validates incoming request bodies, query params, and URL parameters against Zod schemas

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  data?: any;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Create a validation middleware from a Zod schema.
 * Validates the specified part of the request (body, query, or params).
 *
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export function validate(schema: ZodSchema<any>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const parsed = schema.parse(data);

      // Attach validated data to request for downstream use
      if (source === 'body') {
        req.body = parsed;
      } else if (source === 'query') {
        req.query = parsed as any;
      } else if (source === 'params') {
        req.params = parsed as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate request body against a Zod schema.
 */
export function validateBody(schema: ZodSchema<any>) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery(schema: ZodSchema<any>) {
  return validate(schema, 'query');
}

/**
 * Validate URL parameters against a Zod schema.
 */
export function validateParams(schema: ZodSchema<any>) {
  return validate(schema, 'params');
}
