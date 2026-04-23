// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTags } from './api.js';
import { buildForest, filterForest, type TagNode } from './tree.js';
import { useTagSelection } from './useTagSelection.js';

interface TagTreeRowProps {
  node: TagNode;
  depth: number;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}

function TagTreeRow({ node, depth, isSelected, onToggle }: TagTreeRowProps): JSX.Element {
  const selected = isSelected(node.tag.id);
  return (
    <li role="treeitem" aria-selected={selected}>
      <button
        type="button"
        onClick={() => onToggle(node.tag.id)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          background: selected ? 'var(--selected-bg, #1d4ed8)' : 'transparent',
          color: selected ? 'white' : 'inherit',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {node.tag.name}
      </button>
      {node.children.length > 0 && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <TagTreeRow
              key={child.tag.id}
              node={child}
              depth={depth + 1}
              isSelected={isSelected}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TagTree(): JSX.Element {
  const [query, setQuery] = useState('');
  const { isSelected, toggle } = useTagSelection();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    retry: false,
  });

  const roots = useMemo(() => (data ? buildForest(data) : []), [data]);
  const filtered = useMemo(() => filterForest(roots, query), [roots, query]);

  return (
    <aside
      aria-label="Tag tree"
      style={{
        width: 280,
        borderRight: '1px solid #ddd',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <label style={{ display: 'block', marginBottom: '0.5rem' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', color: '#555' }}>Search tags</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
        />
      </label>
      {isLoading && <p>Loading tags…</p>}
      {isError && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error instanceof Error ? error.message : 'Failed to load tags'}
        </p>
      )}
      {!isLoading && !isError && data && data.length === 0 && (
        <p style={{ color: '#666' }}>
          No tags yet — create some in Immich.
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && data && data.length > 0 && (
        <p style={{ color: '#666' }}>No tags match “{query}”.</p>
      )}
      <ul role="tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {filtered.map((node) => (
          <TagTreeRow
            key={node.tag.id}
            node={node}
            depth={0}
            isSelected={isSelected}
            onToggle={toggle}
          />
        ))}
      </ul>
    </aside>
  );
}
