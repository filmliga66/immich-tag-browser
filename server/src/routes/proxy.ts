// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import { fetch } from 'undici';
import { Readable } from 'node:stream';
import type { Config } from '../config.js';
import { getSession, clearSessionCookie } from '../session.js';

// Headers we forward from the upstream response
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'etag',
  'cache-control',
  'last-modified',
];

// Headers we strip from outgoing proxy requests (never forward client's auth/cookie headers)
const STRIP_REQUEST_HEADERS = new Set(['authorization', 'cookie', 'host']);

export async function proxyRoutes(
  fastify: FastifyInstance,
  config: Config,
): Promise<void> {
  fastify.all('/api/*', async (request, reply) => {
    const session = getSession(request, config.sessionSecret);
    if (!session) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Normalise path and guard against traversal
    const rawPath = (request.params as { '*': string })['*'];
    const normalised = new URL(`/api/${rawPath}`, config.immichOrigin);
    if (!normalised.pathname.startsWith('/api/')) {
      return reply.status(400).send({ error: 'Invalid path' });
    }

    // Preserve query string
    const upstreamUrl = new URL(normalised.pathname, config.immichOrigin);
    const incoming = new URL(request.url, 'http://localhost');
    incoming.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

    // Build forwarded headers (strip auth/cookie from client)
    const forwardHeaders: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
    };
    for (const [k, v] of Object.entries(request.headers)) {
      if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase()) && typeof v === 'string') {
        forwardHeaders[k] = v;
      }
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    // Fastify parses JSON bodies into objects; re-serialize so undici sends valid JSON.
    let proxyBody: string | undefined;
    if (hasBody && request.body !== undefined && request.body !== null) {
      proxyBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: proxyBody,
      duplex: hasBody ? 'half' : undefined,
    } as Parameters<typeof fetch>[1]);

    // 401 from Immich → clear our session cookie, surface as 401
    if (upstream.status === 401) {
      clearSessionCookie(reply);
      return reply.status(401).send({ error: 'Session expired' });
    }

    // Forward selected response headers
    for (const h of FORWARD_RESPONSE_HEADERS) {
      const val = upstream.headers.get(h);
      if (val) void reply.header(h, val);
    }

    reply.status(upstream.status);

    // Stream body via reply.send() so Fastify owns the response lifecycle.
    // Piping to reply.raw directly causes ERR_HTTP_HEADERS_SENT because
    // Fastify's error handler tries to write headers after the raw stream ends.
    if (upstream.body) {
      const readable = Readable.fromWeb(
        upstream.body as Parameters<typeof Readable.fromWeb>[0],
      );
      return reply.send(readable);
    }
    return reply.send();
  });
}
