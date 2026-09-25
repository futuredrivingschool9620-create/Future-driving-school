import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;
  const method = req.method;

  let statusCode = 500;
  if (err instanceof ValidationError || err instanceof AppError) {
    statusCode = err.statusCode;
  }

  const isDbError =
    (err as any)?.code?.startsWith?.('P') ||
    err.message?.includes('database') ||
    err.message?.includes('10054') ||
    err.message?.includes('ConnectionReset');

  // Structured diagnostic logging for both dev and production (without logging customer PII)
  console.error(
    `[SERVER-ERROR] [${timestamp}] [${method} ${path}] status=${statusCode} ` +
    `${isDbError ? '[DB-FAILURE] ' : ''}msg="${err.message?.replace(/[\r\n]+/g, ' ')}"`
  );

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: err.message,
      errors: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unknown errors — don't leak stack traces in production response
  res.status(500).json({
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}
