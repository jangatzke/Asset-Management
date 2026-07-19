import { Request, Response, NextFunction } from 'express';

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULT_OPTIONS: PaginationOptions = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
};

/**
 * Parse and validate pagination parameters from query string.
 */
export function parsePagination(
  req: Request,
  options: PaginationOptions = DEFAULT_OPTIONS
): { page: number; limit: number; skip: number; sort?: string; order?: 'asc' | 'desc'; fields?: string } {
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? 20;
  
  const page = Math.max(1, parseInt(req.query.page as string, 10) || defaultPage);
  let limit = parseInt(req.query.limit as string, 10) || defaultLimit;
  
  // Enforce max limit
  if (limit > (options.maxLimit ?? 100)) {
    limit = options.maxLimit!;
  }

  const skip = (page - 1) * limit;

  // Parse sort parameter
  let sort: string | undefined;
  let order: 'asc' | 'desc' | undefined;

  if (req.query.sort) {
    sort = req.query.sort as string;
    const rawOrder = (req.query.order as string) || 'asc';
    order = rawOrder === 'desc' ? 'desc' : 'asc';
  }

  // Parse fields parameter for field selection
  const fields = req.query.fields as string | undefined;

  return { page, limit, skip, sort, order, fields };
}

/**
 * Pagination Middleware
 * Adds pagination support to request object.
 */
export function paginate(options: PaginationOptions = DEFAULT_OPTIONS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = parsePagination(req, options);
    
    (req as Request & { pagination: ReturnType<typeof parsePagination> }).pagination = parsed;

    // Attach helper for setting pagination headers/metadata on response
    res.paginateResponse = <T>(data: T[], total: number): void => {
      const totalPages = Math.ceil(total / parsed.limit);
      
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(parsed.page));
      res.set('X-Limit', String(parsed.limit));
      res.set('X-Total-Pages', String(totalPages));

      // Set pagination links if base URL is available
      const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
      
      if (parsed.page > 1) {
        res.set('Link', `<${baseUrl}?page=1&limit=${parsed.limit}>; rel="prev"`);
      }
      if (parsed.page < totalPages) {
        res.set('Link', `<${baseUrl}?page=${parsed.page + 1}&limit=${parsed.limit}>; rel="next"`);
      }

      // Return paginated response structure
      const originalJson = res.json.bind(res);
      originalJson({
        data,
        meta: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          totalPages,
        },
      });
    };

    next();
  };
}

// Extend Express Response type for paginateResponse
declare global {
  namespace Express {
    interface Response {
      paginateResponse<T>(data: T[], total: number): void;
    }
  }
}

/**
 * Parse sort parameters from query string.
 */
export function parseSort(req: Request): { field?: string; direction?: 'asc' | 'desc' } {
  const rawSort = req.query.sort as string | undefined;
  const rawOrder = (req.query.order as string) || 'asc';

  if (!rawSort) {
    return {};
  }

  // Handle compound sort (e.g., "field1 asc, field2 desc")
  const sorts = rawSort.split(',').map(s => s.trim());
  
  return {
    field: sorts[0],
    direction: rawOrder === 'desc' ? 'desc' : 'asc',
  };
}

/**
 * Bulk operation result.
 */
export interface BulkOperationResult<_T = never> {
  succeeded: Array<{ id: string; status: number }>;
  failed: Array<{ id?: string; error: string; status: number }>;
  total: number;
  succeededCount: number;
  failedCount: number;
}

/**
 * Validate bulk operation input.
 */
export function validateBulkInput<_T = unknown>(
  items: unknown[],
  maxItems: number = 100,
  validator?: (item: unknown) => { valid: boolean; error?: string }
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(items)) {
    return { valid: false, errors: ['Request body must be an array'] };
  }

  if (items.length === 0) {
    return { valid: false, errors: ['At least one item is required'] };
  }

  if (items.length > maxItems) {
    errors.push(`Maximum ${maxItems} items allowed per bulk operation`);
  }

  if (validator) {
    for (let i = 0; i < items.length; i++) {
      const result = validator(items[i]);
      if (!result.valid) {
        errors.push(`Item ${i + 1}: ${result.error}`);
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
