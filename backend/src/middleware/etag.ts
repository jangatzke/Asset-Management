import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const ETAG_HEADER = 'ETag';
export const IF_NONE_MATCH_HEADER = 'If-None-Match';
export const IF_MATCH_HEADER = 'If-Match';
export const VERSION_HEADER = 'X-Resource-Version';

interface EtagOptions {
  /** Custom key generator for the resource */
  keyGenerator?: (req: Request) => string;
  /** Whether to include version in etag */
  includeVersion?: boolean;
}

/**
 * Generate an ETag from a value.
 */
export function generateEtag(value: unknown): string {
  const str = JSON.stringify(value);
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `"${hash}"`;
}

/**
 * Parse If-None-Match header value.
 */
function parseIfNoneMatch(header: string): string[] {
  return header.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse If-Match header value.
 */
function parseIfMatch(header: string): string[] {
  return header.split(',').map(s => s.trim().replace(/^"/, '').replace(/"$/, '')).filter(Boolean);
}

/**
 * ETag Middleware Factory
 * Provides conditional GET support with ETags for optimistic locking.
 */
export function etag(options: EtagOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const { includeVersion = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to GET requests for caching/ETag
    if (req.method === 'GET') {
      const ifNoneMatch = req.headers[IF_NONE_MATCH_HEADER] as string | undefined;
      
      if (ifNoneMatch) {
        // Store original json method to intercept response
        const originalJson = res.json.bind(res);
        
        res.json = (body: unknown) => {
          const etag = generateEtag(body);
          
          // Check if resource has not been modified
          const etags = parseIfNoneMatch(ifNoneMatch);
          const isNotModified = etags.includes(etag) || etags.includes('*');

          if (isNotModified) {
            res.set(ETAG_HEADER, etag);
            if (includeVersion && typeof body === 'object' && body !== null && 'version' in body) {
              res.set(VERSION_HEADER, String((body as Record<string, unknown>).version));
            }
            return res.status(304).send();
          }

          res.set(ETAG_HEADER, etag);
          if (includeVersion && typeof body === 'object' && body !== null && 'version' in body) {
            res.set(VERSION_HEADER, String((body as Record<string, unknown>).version));
          }
          
          return originalJson(body);
        };
      } else {
        // Store original json method to add ETag header
        const originalJson = res.json.bind(res);
        
        res.json = (body: unknown) => {
          const etag = generateEtag(body);
          res.set(ETAG_HEADER, etag);
          if (includeVersion && typeof body === 'object' && body !== null && 'version' in body) {
            res.set(VERSION_HEADER, String((body as Record<string, unknown>).version));
          }
          
          return originalJson(body);
        };
      }
    } else if (req.method === 'PATCH' || req.method === 'PUT') {
      // Optimistic locking: require If-Match header for updates
      const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
      
      if (ifMatch) {
        // Store the parsed etags on the request for use in route handlers
        (req as Request & { requiredEtags?: string[] }).requiredEtags = parseIfMatch(ifMatch);
      }
    }

    next();
  };
}

/**
 * Optimistic Locking Middleware
 * Validates If-Match header against resource version to prevent lost updates.
 */
export const optimisticLock = (
  versionGetter: (req: Request) => Promise<string | undefined>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    
    if (!ifMatch) {
      // If-Match header is optional for PATCH/PUT - warn but don't block
      return next();
    }

    try {
      const currentVersion = await versionGetter(req);
      
      if (!currentVersion) {
        // Resource not found or no version tracking
        return next();
      }

      const requiredEtags = parseIfMatch(ifMatch);
      const currentEtag = `"v${currentVersion}"`;
      
      if (!requiredEtags.includes(currentEtag) && !requiredEtags.includes('*')) {
        res.set(ETAG_HEADER, currentEtag);
        res.status(412).json({
          error: 'Precondition Failed',
          message: 'Resource has been modified by another party. Please refresh and try again.',
          currentVersion,
          currentEtag: currentEtag,
        });
        return;
      }
    } catch (error) {
      // If version check fails, proceed without blocking
    }

    next();
  };
};

/**
 * Get the current resource version from request.
 */
export function getResourceVersion(req: Request): number | undefined {
  const version = req.headers['x-resource-version'];
  if (version && typeof version === 'string') {
    const parsed = parseInt(version, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}
