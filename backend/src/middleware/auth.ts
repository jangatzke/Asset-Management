import { Request, Response, NextFunction } from 'express';
import jwt, { Algorithm } from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const JWT_ALGORITHMS: Algorithm[] = ['HS256'];

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'secret' || secret.length < 32) {
    throw new AppError('JWT secret is not securely configured', 500);
  }
  return secret;
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: JWT_ALGORITHMS }) as {
      userId: string;
      roles?: string[];
    };
    req.userId = decoded.userId;
    req.userRoles = decoded.roles ?? [];
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
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
