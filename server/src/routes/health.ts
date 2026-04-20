// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import { fetch } from 'undici';
import type { Config } from '../config.js';

const READYZ_CACHE_TTL_MS = 30_000;

interface ReadyState {
  ok: boolean;
  lastChecked: number;
}

let readyState: ReadyState = { ok: false, lastChecked: 0 };

async function probeImmich(config: Config): Promise<boolean> {
  try {
    const res = await fetch(`${config.immichOrigin}/api/server/ping`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function scheduleReadyzProbe(config: Config): void {
  setInterval(async () => {
    const ok = await probeImmich(config);
    readyState = { ok, lastChecked: Date.now() };
  }, READYZ_CACHE_TTL_MS);
}

export async function healthRoutes(
  fastify: FastifyInstance,
  config: Config,
): Promise<void> {
  // Kick off initial probe and start the background poller
  readyState = { ok: await probeImmich(config), lastChecked: Date.now() };
  scheduleReadyzProbe(config);

  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({ ok: true });
  });

  fastify.get('/readyz', async (_request, reply) => {
    if (readyState.ok) {
      return reply.status(200).send({ ok: true });
    }
    return reply.status(503).send({ ok: false, reason: 'Immich unreachable' });
  });
}
