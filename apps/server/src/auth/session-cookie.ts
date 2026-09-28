import type { Request, Response } from 'express';
import { SESSION_TTL_MS } from './sessions.service.js';

export const SESSION_COOKIE = 'jobify_session';

export function readSessionCookie(request: Request): string | undefined {
  return (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
}

export function setSessionCookie(request: Request, response: Response, token: string): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.secure,
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE);
}
