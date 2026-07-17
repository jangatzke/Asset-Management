import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  console.log('[Auth] Authorization header:', header);
  console.log('[Auth] Token:', token ? `${token.substring(0, 20)}...` : 'none');

  if (!token) {
    console.log('[Auth] No token provided');
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      roles: string[];
    };
    req.userId = decoded.userId;
    req.userRoles = decoded.roles;
    console.log('[Auth] Authenticated user:', req.userId);
    next();
  } catch (error) {
    console.log('[Auth] Token verification failed:', (error as Error).message);
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    if (roles.length && !roles.some(role => req.userRoles?.includes(role))) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
};
