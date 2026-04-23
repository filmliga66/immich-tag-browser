// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../features/auth/api.js';

/** Validates that a redirect target is a safe same-origin relative path. */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/browse';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/browse';
  }
  try {
    // Must not contain a scheme or host — a relative URL parsed against a dummy base
    // should yield the same path without changing origin.
    const url = new URL(raw, 'http://localhost');
    if (url.origin !== 'http://localhost') return '/browse';
  } catch {
    return '/browse';
  }
  return raw;
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const redirect = safeRedirect(searchParams.get('redirect'));
      void navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-immich-gray-50 dark:bg-immich-dark-bg">
      <div className="w-full max-w-sm rounded-lg border border-immich-gray-200 bg-immich-bg p-8 shadow-sm dark:border-immich-gray-800 dark:bg-immich-gray-900">
        <h1 className="mb-6 text-xl font-semibold text-immich-gray-900 dark:text-immich-dark-fg">Immich Tag Browser</h1>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-immich-gray-700 dark:text-immich-gray-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded border border-immich-gray-200 bg-immich-bg px-3 py-2 text-sm text-immich-gray-900 focus:outline-none focus:ring-2 focus:ring-immich-primary dark:border-immich-gray-700 dark:bg-immich-gray-900 dark:text-immich-dark-fg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-immich-gray-700 dark:text-immich-gray-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded border border-immich-gray-200 bg-immich-bg px-3 py-2 text-sm text-immich-gray-900 focus:outline-none focus:ring-2 focus:ring-immich-primary dark:border-immich-gray-700 dark:bg-immich-gray-900 dark:text-immich-dark-fg"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-immich-primary px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50 dark:bg-immich-dark-primary dark:text-immich-gray-900"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </main>
  );
}
