// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetch } from 'undici';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { loadConfig } from './config.js';
import { authRoutes } from './routes/auth.js';
import { proxyRoutes } from './routes/proxy.js';
import { healthRoutes } from './routes/health.js';
import { registerOriginCheck } from './middleware/originCheck.js';

// Baked in at build time by the CI pipeline; fallback for local dev.
const IMMICH_SPEC_SHA = process.env['IMMICH_SPEC_SHA'] ?? 'dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const config = await loadConfig();

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            // Never log Authorization or Cookie headers
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    },
  });

  await fastify.register(fastifyCookie);

  // Origin-check middleware for all mutating routes
  const ownOrigin = `http${config.cookieSecure ? 's' : ''}://localhost:${config.port}`;
  registerOriginCheck(fastify, ownOrigin);

  // Register route handlers
  await authRoutes(fastify, config);
  await proxyRoutes(fastify, config);
  await healthRoutes(fastify, config);

  // Serve the SPA static files in production (web/dist is copied here by Docker)
  const staticPath = path.resolve(__dirname, '../../web/dist');
  try {
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback — serve index.html for all unmatched GET routes
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.method === 'GET') {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  } catch {
    fastify.log.info('web/dist not found — running in API-only mode (dev)');
    fastify.setNotFoundHandler(async (_request, reply) => {
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // Startup: check Immich version and log spec SHA for drift detection
  try {
    const res = await fetch(`${config.immichOrigin}/api/server/version`);
    if (res.ok) {
      const version = (await res.json()) as { major: number; minor: number; patch: number };
      fastify.log.info(
        { immichVersion: `${version.major}.${version.minor}.${version.patch}`, specSha: IMMICH_SPEC_SHA },
        'Connected to Immich',
      );
    } else {
      fastify.log.warn({ status: res.status }, 'Could not retrieve Immich server version');
    }
  } catch (err) {
    fastify.log.warn({ err }, 'Could not connect to Immich on startup');
  }

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
