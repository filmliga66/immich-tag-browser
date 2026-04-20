// SPDX-License-Identifier: AGPL-3.0-or-later

export interface LoginResult {
  name: string;
  userId: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Login failed (${res.status})`);
  }
  return res.json() as Promise<LoginResult>;
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export interface UserMe {
  id: string;
  name: string;
  email: string;
}

export async function fetchMe(): Promise<UserMe> {
  const res = await fetch('/api/users/me', { credentials: 'include' });
  if (res.status === 401) {
    throw new Error('unauthenticated');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch user (${res.status})`);
  }
  return res.json() as Promise<UserMe>;
}
