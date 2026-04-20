// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Reject mutating requests whose Origin header doesn't match the server's own
 * origin, derived from the request's Host header + the server's scheme.
 *
 * Using Host-reflection (rather than a configured allowlist) means the check
 * works regardless of which IP/hostname the browser uses to reach the server
 * (localhost, LAN IP, Tailscale IP, public domain, etc.). A cross-origin
 * attacker's page will send its own origin, which won't match the Host the
 * browser is sending to this server.
 *
 * ALLOWED_ORIGINS is kept as an escape hatch for the Vite dev-server proxy
 * case, where the Origin is :5173 but the Host is :8080.
 */
export function registerOriginCheck(
  fastify: FastifyInstance,
  scheme: 'http' | 'https',
  extraAllowed: Set<string>,
): void {
  fastify.addHook('onRequest', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;

    const origin = request.headers['origin'];
    const host = request.headers['host'];

    if (!origin || !host) {
      request.log.warn({ origin, host }, 'Origin check failed: missing header');
      return reply.status(403).send({ error: 'Forbidden: invalid Origin' });
    }

    const expected = `${scheme}://${host}`;
    if (origin !== expected && !extraAllowed.has(origin)) {
      request.log.warn({ origin, expected }, 'Origin check failed');
      return reply.status(403).send({ error: 'Forbidden: invalid Origin' });
    }
  });
}
