// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { signValue, unsignValue } from './config.js';
import { encodeSession, decodeSession } from './session.js';

const SECRET = 'test-secret-value-for-unit-tests-only';

describe('signValue / unsignValue', () => {
  it('round-trips correctly', () => {
    const signed = signValue('hello', SECRET);
    expect(unsignValue(signed, SECRET)).toBe('hello');
  });

  it('returns null for tampered value', () => {
    const signed = signValue('hello', SECRET);
    const tampered = signed.replace('hello', 'world');
    expect(unsignValue(tampered, SECRET)).toBeNull();
  });

  it('returns null for bad signature', () => {
    expect(unsignValue('no-dot-here', SECRET)).toBeNull();
  });
});

describe('encodeSession / decodeSession', () => {
  const payload = {
    accessToken: 'tok123',
    userId: 'user-abc',
    userEmail: 'test@example.com',
  };

  it('round-trips session payload', () => {
    const encoded = encodeSession(payload, SECRET);
    const decoded = decodeSession(encoded, SECRET);
    expect(decoded).toEqual(payload);
  });

  it('returns null for tampered session', () => {
    const encoded = encodeSession(payload, SECRET);
    // corrupt last char
    const tampered = encoded.slice(0, -1) + (encoded.endsWith('a') ? 'b' : 'a');
    expect(decodeSession(tampered, SECRET)).toBeNull();
  });
});
