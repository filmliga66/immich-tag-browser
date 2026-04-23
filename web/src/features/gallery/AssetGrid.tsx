// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { searchAssets, thumbnailUrl } from './api.js';
import { useTagSelection } from '../tags/useTagSelection.js';

export function AssetGrid(): JSX.Element {
  const { selected } = useTagSelection();

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['search', selected],
    queryFn: () => searchAssets({ tagIds: selected }),
    enabled: selected.length > 0,
    retry: false,
  });

  if (selected.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#666' }}>
        Select one or more tags to see matching assets.
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading assets…</div>;
  }

  if (isError) {
    return (
      <div role="alert" style={{ padding: '2rem', color: 'crimson' }}>
        {error instanceof Error ? error.message : 'Failed to load assets'}
      </div>
    );
  }

  const items = data?.assets.items ?? [];
  const total = data?.assets.total ?? 0;

  if (items.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#666' }}>
        No assets match all {selected.length} tag{selected.length === 1 ? '' : 's'}.
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
      <p style={{ margin: '0 0 0.75rem', color: '#555', fontSize: '0.85rem' }}>
        Showing {items.length} of {total} asset{total === 1 ? '' : 's'}
        {isFetching && ' · refreshing…'}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 8,
        }}
      >
        {items.map((asset) => (
          <img
            key={asset.id}
            src={thumbnailUrl(asset.id)}
            alt={asset.originalFileName}
            loading="lazy"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              borderRadius: 4,
              background: '#eee',
            }}
          />
        ))}
      </div>
    </div>
  );
}
