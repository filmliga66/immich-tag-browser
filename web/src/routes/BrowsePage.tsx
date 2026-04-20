// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMe, logout } from '../features/auth/api.js';

export function BrowsePage(): JSX.Element {
  const navigate = useNavigate();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  if (isLoading) {
    return <p>Loading…</p>;
  }

  if (isError || !user) {
    // fetchMe throws 'unauthenticated' on 401 — redirect handled by RequireAuth wrapper,
    // but handle defensive fallback here too.
    void navigate('/login', { replace: true });
    return <p>Redirecting…</p>;
  }

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate('/login', { replace: true });
  }

  return (
    <main style={{ padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Immich Tag Browser</h1>
        <button onClick={() => void handleLogout()}>Log out</button>
      </header>
      <p>Hello, {user.name}</p>
    </main>
  );
}
