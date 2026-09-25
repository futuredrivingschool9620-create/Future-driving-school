import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: AccessTokenPayload;
    }
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      throw new UnauthorizedError('Missing token');
    }

    const payload = verifyAccessToken(token);
    req.admin = payload;
    next();
  } catch (error) {
    const timestamp = new Date().toISOString();
    const reason = error instanceof UnauthorizedError ? error.message : 'Invalid or expired token';
    console.warn(`[AUTH-FAILURE] [${timestamp}] [${req.method} ${req.originalUrl || req.url}] reason="${reason}"`);
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}
