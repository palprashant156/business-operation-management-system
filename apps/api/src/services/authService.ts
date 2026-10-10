import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { User, toSafeUser, type UserRole } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { hashPassword, verifyPassword, isStrongPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import type { RegisterInput, LoginInput } from '../validators/auth.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function register(input: RegisterInput): Promise<{ user: ReturnType<typeof toSafeUser> }> {
  const email = input.email.toLowerCase().trim();
  if (!isStrongPassword(input.password)) {
    throw AppError.badRequest('Password needs at least 8 characters with a letter and a number.');
  }
  const existing = await User.findOne({ email }).lean();
  if (existing) throw AppError.conflict('An account with this email already exists.');
  const passwordHash = await hashPassword(input.password);
  // Safe default: public registration is always EMPLOYEE. Admins promote via PATCH /users/:id/role.
  const created = await User.create({ name: input.name.trim(), email, passwordHash, role: 'EMPLOYEE' as UserRole, status: 'ACTIVE' });
  const doc = await User.findById(created._id).lean();
  if (!doc) throw new AppError(500, 'INTERNAL_ERROR', 'Registration failed.');
  return { user: toSafeUser(doc as never) };
}

export async function login(input: LoginInput): Promise<{ user: ReturnType<typeof toSafeUser>; tokens: AuthTokens }> {
  const email = input.email.toLowerCase().trim();
  // Generic message avoids leaking whether email exists.
  const invalid = AppError.unauthorized('Invalid email or password.');
  const found = await User.findOne({ email }).select('+passwordHash').lean();
  if (!found) throw invalid;
  if (found.status !== 'ACTIVE') throw AppError.forbidden('This account is deactivated.');
  const okPass = await verifyPassword(input.password, found.passwordHash);
  if (!okPass) throw invalid;

  const accessToken = signAccessToken(String(found._id), found.role);
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken(String(found._id), tokenId);
  await RefreshToken.create({ userId: found._id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() });

  const safe = await User.findById(found._id).lean();
  return { user: toSafeUser(safe as never), tokens: { accessToken, refreshToken } };
}

export async function rotateRefresh(oldToken: string): Promise<AuthTokens> {
  let claims;
  try {
    claims = verifyRefreshToken(oldToken);
  } catch {
    throw AppError.unauthorized('Session expired. Please log in again.');
  }
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(oldToken) });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Session expired. Please log in again.');
  }
  // Rotation: revoke old, issue new pair.
  stored.revokedAt = new Date();
  await stored.save();
  const user = await User.findById(claims.sub).lean();
  if (!user || user.status !== 'ACTIVE') throw AppError.unauthorized('Session expired.');
  const accessToken = signAccessToken(String(user._id), user.role);
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken(String(user._id), tokenId);
  await RefreshToken.create({ userId: user._id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() });
  return { accessToken, refreshToken };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(refreshToken) }, { $set: { revokedAt: new Date() } });
}

export async function getCurrentUser(userId: string): Promise<ReturnType<typeof toSafeUser>> {
  const doc = await User.findById(userId).lean();
  if (!doc || doc.status !== 'ACTIVE') throw AppError.unauthorized('Session expired.');
  return toSafeUser(doc as never);
}
