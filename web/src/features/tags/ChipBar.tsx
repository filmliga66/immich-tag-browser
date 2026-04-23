// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { fetchTags } from './api.js';
import { useTagSelection } from './useTagSelection.js';

export function ChipBar(): JSX.Element | null {
  const { selected, remove, clear } = useTagSelection();
  const { data } = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    retry: false,
  });

  if (selected.length === 0) return null;

  const byId = new Map(data?.map((t) => [t.id, t]) ?? []);

  return (
    <div
      aria-label="Selected tags"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #ddd',
      }}
    >
      {selected.map((id) => {
        const tag = byId.get(id);
        const label = tag ? tag.name : id;
        return (
          <span
            key={id}
            aria-selected="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              background: '#1d4ed8',
              color: 'white',
              fontSize: '0.85rem',
            }}
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={() => remove(id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'white',
                cursor: 'pointer',
                font: 'inherit',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={clear}
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: '1px solid #999',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Clear all
      </button>
    </div>
  );
}
