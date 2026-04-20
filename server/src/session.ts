// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyRequest, FastifyReply } from 'fastify';
import { signValue, unsignValue } from './config.js';
import type { SessionPayload } from '@immich-tag-browser/shared';

export const SESSION_COOKIE = 'session';
const COOKIE_MAX_AGE = 604_800; // 7 days

export function encodeSession(payload: SessionPayload, secret: string): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return signValue(raw, secret);
}

export function decodeSession(
  signed: string,
  secret: string,
): SessionPayload | null {
  const raw = unsignValue(signed, secret);
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  reply: FastifyReply,
  payload: SessionPayload,
  secret: string,
  secure: boolean,
): void {
  const value = encodeSession(payload, secret);
  reply.setCookie(SESSION_COOKIE, value, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSession(
  request: FastifyRequest,
  secret: string,
): SessionPayload | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  return decodeSession(raw, secret);
}
