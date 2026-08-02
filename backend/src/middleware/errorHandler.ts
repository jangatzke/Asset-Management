import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export interface ApiErrorDetail {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: ApiErrorDetail[];
    stack?: string;
  };
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Determine error code for better client-side handling
  let errorCode = (err as AppError).name === 'AppError' ? 'OPERATIONAL_ERROR' : 'INTERNAL_ERROR';
  
  // Map common status codes to error codes
  if (statusCode === 404) errorCode = 'NOT_FOUND';
  if (statusCode === 401) errorCode = 'UNAUTHORIZED';
  if (statusCode === 403) errorCode = 'FORBIDDEN';
  if (statusCode === 409) errorCode = 'CONFLICT';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};
