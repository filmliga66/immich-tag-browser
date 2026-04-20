// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Reject mutating requests whose Origin header doesn't match our own origin.
 * Guards against CSRF for SameSite=Lax cookies (which don't protect top-level POSTs).
 */
export function registerOriginCheck(fastify: FastifyInstance, ownOrigin: string): void {
  fastify.addHook('onRequest', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;

    const origin = request.headers['origin'];
    if (!origin || origin !== ownOrigin) {
      request.log.warn({ origin, expected: ownOrigin }, 'Origin check failed');
      return reply.status(403).send({ error: 'Forbidden: invalid Origin' });
    }
  });
}
