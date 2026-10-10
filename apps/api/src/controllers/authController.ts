import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/pagination.js';
import * as authService from '../services/authService.js';
import { env } from '../config/env.js';

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: env.COOKIE_SECURE, path: '/' };
  res.cookie('accessToken', tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(ok(result));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  setAuthCookies(res, tokens);
  res.json(ok({ user, accessToken: tokens.accessToken }));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const old = (req.cookies as Record<string, string | undefined> | undefined)?.['refreshToken'];
  if (!old) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired.', details: [] } });
    return;
  }
  const tokens = await authService.rotateRefresh(old);
  setAuthCookies(res, tokens);
  res.json(ok({ accessToken: tokens.accessToken }));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rt = (req.cookies as Record<string, string | undefined> | undefined)?.['refreshToken'];
  await authService.logout(rt);
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json(ok({ loggedOut: true }));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json(ok({ user }));
});
