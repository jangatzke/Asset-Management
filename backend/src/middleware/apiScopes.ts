import { Request, Response, NextFunction } from 'express';

export const SCOPE_HEADER = 'X-API-Scopes';

export type ScopeCategory = 'asset' | 'risk' | 'control' | 'incident' | 'admin' | 'webhook' | 'serviceaccount' | 'system';

export interface ApiScope {
  scope: string;
  description?: string;
  category: ScopeCategory;
}

/**
 * Check if the given scopes include all required scopes.
 */
export function hasRequiredScopes(
  grantedScopes: string[],
  requiredScopes: string[]
): boolean {
  return requiredScopes.every(required => 
    grantedScopes.some(granted => 
      granted === required || granted.endsWith(':*') || 
      granted.split(':')[0] + ':*' === required
    )
  );
}

/**
 * Extract scopes from a service account's scope list.
 */
export function extractScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) {
    return scopes.filter(s => typeof s === 'string') as string[];
  }
  return [];
}

/**
 * API Scopes Middleware Factory
 * Validates that the authenticated principal has the required API scopes.
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get scopes from request context (set by auth middleware)
    const requestWithScopes = req as Request & { 
      serviceAccountScopes?: string[];
      userScopes?: string[];
    };

    const grantedScopes = [
      ...extractScopes(requestWithScopes.serviceAccountScopes || []),
      ...extractScopes(requestWithScopes.userScopes || []),
    ];

    // Check if any wildcard scope grants access
    const hasWildcard = grantedScopes.some(s => s === '*');
    
    if (hasWildcard) {
      return next();
    }

    // Check required scopes
    const missingScopes = requiredScopes.filter(required => 
      !grantedScopes.includes(required) && 
      !grantedScopes.some(s => s.split(':')[0] + ':*' === required)
    );

    if (missingScopes.length > 0) {
      res.status(403).json({
        error: 'Insufficient Scopes',
        message: 'The requested operation requires additional API scopes.',
        missingScopes,
        grantedScopes,
      });
      return;
    }

    next();
  };
}

/**
 * Scope-based route filtering middleware.
 * Attaches scope requirements to routes for documentation/auditing.
 */
export const scopeAudit = (req: Request, _res: Response, next: NextFunction): void => {
  // Log the scopes used for this request (for auditing)
  const requestWithScopes = req as Request & { 
    serviceAccountScopes?: string[];
    userScopes?: string[];
  };

  const allScopes = [
    ...extractScopes(requestWithScopes.serviceAccountScopes || []),
    ...extractScopes(requestWithScopes.userScopes || []),
  ];

  // Attach to request for later use in audit logging
  (req as Request & { effectiveScopes?: string[] }).effectiveScopes = allScopes;

  next();
};
