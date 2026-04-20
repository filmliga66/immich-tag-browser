// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHmac, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() !== 'false' && val !== '0';
}

/** RFC1918 + loopback + link-local ranges */
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd/,
  /^fe80:/,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

export async function validateImmichUrl(
  rawUrl: string,
  allowPrivate: boolean,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`IMMICH_URL is not a valid URL: ${rawUrl}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`IMMICH_URL must be http or https, got: ${parsed.protocol}`);
  }
  if (!allowPrivate) {
    const addresses = await lookup(parsed.hostname, { all: true }).catch(() => []);
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        throw new Error(
          `IMMICH_URL resolves to a private/loopback address (${address}). ` +
            `Set ALLOW_PRIVATE_IMMICH=true to permit this.`,
        );
      }
    }
  }
  return parsed;
}

export interface Config {
  immichUrl: URL;
  immichOrigin: string;
  port: number;
  sessionSecret: string;
  cookieSecure: boolean;
  scheme: 'http' | 'https';
  tagsCacheTtlSeconds: number;
  logLevel: string;
  allowPrivateImmich: boolean;
  /** Extra origins beyond host-reflection (e.g. Vite dev server). */
  extraAllowedOrigins: Set<string>;
}

export async function loadConfig(): Promise<Config> {
  const rawUrl = env('IMMICH_URL');
  const allowPrivate = envBool('ALLOW_PRIVATE_IMMICH', false);
  const immichUrl = await validateImmichUrl(rawUrl, allowPrivate);

  const sessionSecret = env('SESSION_SECRET', randomBytes(32).toString('hex'));
  if (sessionSecret === 'replace-me-with-a-32-byte-hex-string') {
    throw new Error('SESSION_SECRET has not been changed from the placeholder — set a real secret');
  }

  const port = parseInt(env('PORT', '8080'), 10);
  const cookieSecure = envBool('COOKIE_SECURE', true);
  const scheme = cookieSecure ? 'https' : 'http';

  // ALLOWED_ORIGINS: comma-separated extra origins beyond host-reflection.
  // Only needed when the browser-facing origin differs from the Host header
  // (e.g. Vite dev server on :5173 proxying to the server on :8080).
  const extraAllowedOrigins = new Set(
    (process.env['ALLOWED_ORIGINS'] ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );

  return {
    immichUrl,
    immichOrigin: immichUrl.origin,
    port,
    sessionSecret,
    cookieSecure,
    scheme,
    tagsCacheTtlSeconds: parseInt(env('TAGS_CACHE_TTL_SECONDS', '60'), 10),
    logLevel: env('LOG_LEVEL', 'info'),
    allowPrivateImmich: allowPrivate,
    extraAllowedOrigins,
  };
}

// HMAC-based signed cookie helpers
const SEPARATOR = '.';

export function signValue(value: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}${SEPARATOR}${sig}`;
}

export function unsignValue(signed: string, secret: string): string | null {
  const idx = signed.lastIndexOf(SEPARATOR);
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const expected = createHmac('sha256', secret).update(value).digest('base64url');
  const actual = signed.slice(idx + 1);
  if (actual.length !== expected.length) return null;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0 ? value : null;
}
