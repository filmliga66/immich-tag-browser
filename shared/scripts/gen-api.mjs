#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Fetches the Immich OpenAPI spec from upstream main and generates TypeScript types.
 * Run via: pnpm --filter web run gen:api
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_URL =
  'https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json';
const OUT_DIR = path.resolve(__dirname, '../src/api');

async function main() {
  console.log('Fetching Immich OpenAPI spec from upstream main…');
  const res = await fetch(SPEC_URL);
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
  const specText = await res.text();

  const sha = createHash('sha256').update(specText).digest('hex').slice(0, 12);
  console.log(`Spec SHA: ${sha}`);

  mkdirSync(OUT_DIR, { recursive: true });

  const specPath = path.join(OUT_DIR, 'immich-openapi-specs.json');
  writeFileSync(specPath, specText);
  writeFileSync(path.join(OUT_DIR, 'spec-sha.txt'), sha);

  console.log('Generating TypeScript types with openapi-typescript…');
  execSync(
    `pnpm exec openapi-typescript ${specPath} --output ${path.join(OUT_DIR, 'schema.d.ts')}`,
    { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') },
  );

  console.log(`Done. Types written to ${OUT_DIR}/schema.d.ts`);
  console.log(`Embed IMMICH_SPEC_SHA=${sha} in your Docker build args.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
