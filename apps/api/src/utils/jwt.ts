import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../models/User.js';

export interface AccessClaims {
  sub: string;
  role: UserRole;
  typ: 'access';
}

export interface RefreshClaims {
  sub: string;
  tokenId: string;
  typ: 'refresh';
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessClaims = { sub: userId, role, typ: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);
}

export function signRefreshToken(userId: string, tokenId: string): string {
  const payload: RefreshClaims = { sub: userId, tokenId, typ: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  if (decoded.typ !== 'access' || !decoded.sub) throw new Error('Invalid access token');
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
  if (decoded.typ !== 'refresh' || !decoded.sub || !decoded.tokenId) {
    throw new Error('Invalid refresh token');
  }
  return decoded;
}
