import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import type { UserRole } from '../models/User.js';

export interface AuthPrincipal {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

function tokenFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.['accessToken'];
  return cookie ?? null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = tokenFrom(req);
    if (!token) throw AppError.unauthorized();
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch {
    next(AppError.unauthorized('Session expired or invalid. Please log in again.'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }
    next();
  };
}

export function requireSelfOrRole(paramKey: string, ...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.id === req.params[paramKey] || roles.includes(req.user.role)) return next();
    next(AppError.forbidden());
  };
}
