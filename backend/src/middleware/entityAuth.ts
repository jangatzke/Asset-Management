/**
 * Entity Authorization Middleware
 *
 * Provides entity-level permission checks for asset, risk, control, and incident operations.
 * Uses the central AuthorizationService to validate permissions against role definitions in DB.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { authorizationService, READ_PERMISSION_BY_RESOURCE, WRITE_PERMISSION_BY_RESOURCE } from '../services/authorization.service';
import type { EntityType, EntityAction, PermissionName } from '../services/authorization.service';

/**
 * Middleware factory for entity-level authorization.
 *
 * @param entityType - The entity type to check (assets, risks, controls, incidents)
 * @param action - The action being performed (read, write, delete)
 */
export const authorizeEntity = (entityType: EntityType, action: EntityAction) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    try {
      // Extract entity ID from route params if available
      const entityId = req.params.id || req.params.entityId;

      await authorizationService.requireEntityPermission(userId, entityType, action, entityId);
      next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        // Re-throw authorization errors as-is
        return next(error);
      }
      // For unexpected errors during auth check, pass to error handler
      return next(new AppError('Authorization check failed', 500));
    }
  };
};

/**
 * Middleware for read operations on entities.
 */
export const authorizeEntityRead = (entityType: EntityType) => {
  return authorizeEntity(entityType, 'read');
};

/**
 * Middleware for write operations on entities (create, update).
 */
export const authorizeEntityWrite = (entityType: EntityType) => {
  return authorizeEntity(entityType, 'write');
};

/**
 * Middleware for delete operations on entities.
 */
export const authorizeEntityDelete = (entityType: EntityType) => {
  return authorizeEntity(entityType, 'delete');
};

/**
 * Middleware that requires admin access via role.canAccessAdmin from database.
 * Replaces legacy string-based role checking.
 */
export const requireAdminAccess = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  const userId = req.userId;

  if (!userId) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    await authorizationService.requireAdminAccess(userId);
    next();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return next(error);
    }
    return next(new AppError('Authorization check failed', 500));
  }
};

/**
 * Middleware that requires write permission for any entity type.
 * Used as a general guard for POST, PUT, PATCH, DELETE operations when specific entity type is not applicable.
 */
export const requireWritePermission = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  const userId = req.userId;

  if (!userId) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const canWrite = await authorizationService.canPerformWriteAction(userId);
    if (!canWrite) {
      return next(new AppError('Write permission required. Your role does not allow modifying resources.', 403));
    }
    next();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return next(error);
    }
    return next(new AppError('Authorization check failed', 500));
  }
};

export const requirePermission = (permission: PermissionName) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) return next(new AppError('Authentication required', 401));
    try {
      await authorizationService.require(req.userId, permission);
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const requireEntityPermission = (permission: PermissionName, entityType: EntityType, paramName = 'id') => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) return next(new AppError('Authentication required', 401));
    try {
      await authorizationService.requireForEntity(req.userId, permission, entityType, req.params[paramName]);
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const requireMappedReadPermission = (resource: keyof typeof READ_PERMISSION_BY_RESOURCE) => requirePermission(READ_PERMISSION_BY_RESOURCE[resource]);
export const requireMappedWritePermission = (resource: keyof typeof WRITE_PERMISSION_BY_RESOURCE) => requirePermission(WRITE_PERMISSION_BY_RESOURCE[resource]);
