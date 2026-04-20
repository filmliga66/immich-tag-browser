// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import { fetch } from 'undici';
import type { Config } from '../config.js';
import { setSessionCookie, clearSessionCookie, getSession } from '../session.js';
import type { ImmichLoginResponse } from '@immich-tag-browser/shared';

export async function authRoutes(
  fastify: FastifyInstance,
  config: Config,
): Promise<void> {
  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    let body: unknown;
    try {
      body = request.body;
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !('email' in body) ||
      !('password' in body)
    ) {
      return reply.status(400).send({ error: 'email and password required' });
    }

    const upstream = await fetch(`${config.immichOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      request.log.info({ status: upstream.status }, 'Immich login failed');
      return reply.status(upstream.status).send({ error: text });
    }

    const data = (await upstream.json()) as ImmichLoginResponse;

    setSessionCookie(
      reply,
      {
        accessToken: data.accessToken,
        userId: data.userId,
        userEmail: data.userEmail,
      },
      config.sessionSecret,
      config.cookieSecure,
    );

    return reply.status(200).send({ name: data.name, userId: data.userId });
  });

  // POST /auth/logout
  fastify.post('/auth/logout', async (request, reply) => {
    const session = getSession(request, config.sessionSecret);

    clearSessionCookie(reply);

    if (session) {
      // Best-effort — don't fail logout if Immich is unreachable
      await fetch(`${config.immichOrigin}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch((err: unknown) => {
        request.log.warn({ err }, 'Failed to invalidate Immich session on logout');
      });
    }

    return reply.status(200).send({ ok: true });
  });
}
