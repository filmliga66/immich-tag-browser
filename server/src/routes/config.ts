// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

export async function configRoutes(
  fastify: FastifyInstance,
  config: Config,
): Promise<void> {
  fastify.get('/config', async (_request, reply) => {
    return reply.status(200).send({ immichUrl: config.immichUrl.origin });
  });
}
