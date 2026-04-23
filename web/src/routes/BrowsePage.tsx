// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMe, logout } from '../features/auth/api.js';
import { TagTree } from '../features/tags/TagTree.js';
import { ChipBar } from '../features/tags/ChipBar.js';
import { AssetGrid } from '../features/gallery/AssetGrid.js';

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
    void navigate('/login', { replace: true });
    return <p>Redirecting…</p>;
  }

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate('/login', { replace: true });
  }

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        margin: 0,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #ddd',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Immich Tag Browser</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#555', fontSize: '0.9rem' }}>{user.name}</span>
          <button onClick={() => void handleLogout()}>Log out</button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TagTree />
        <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <ChipBar />
          <AssetGrid />
        </section>
      </div>
    </main>
  );
}
