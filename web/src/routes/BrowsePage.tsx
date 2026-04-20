// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, logout } from '../features/auth/api.js';
import { useTagsQuery } from '../features/tags/useTagsQuery.js';
import { TagSearchBox } from '../features/tags/TagSearchBox.js';
import { TagTree } from '../features/tags/TagTree.js';
import { ChipBar, useSelectedTagIds } from '../features/tags/ChipBar.js';
import { AssetGrid } from '../features/gallery/AssetGrid.js';

export function BrowsePage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tagQuery, setTagQuery] = useState('');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  const { tree, isLoading: tagsLoading } = useTagsQuery();
  const selectedIds = useSelectedTagIds();
  const selectedSet = new Set(selectedIds);

  // Build a flat id→name lookup from the tree for ChipBar labels.
  const tagNameMap = new Map<string, string>();
  function indexTree(nodes: typeof tree): void {
    for (const node of nodes) {
      tagNameMap.set(node.id, node.name);
      indexTree(node.children);
    }
  }
  indexTree(tree);

  function toggleTag(id: string): void {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    const updated = new URLSearchParams(params);
    if (next.size === 0) {
      updated.delete('tags');
    } else {
      updated.set('tags', [...next].join(','));
    }
    setParams(updated, { replace: true });
  }

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Immich Tag Browser</h1>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-gray-600">{user.name}</span>}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail */}
        <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
          <TagSearchBox value={tagQuery} onChange={setTagQuery} />
          {tagsLoading ? (
            <p className="px-3 py-2 text-sm text-gray-400">Loading tags…</p>
          ) : (
            <TagTree
              nodes={tree}
              selectedIds={selectedSet}
              query={tagQuery}
              onToggle={toggleTag}
            />
          )}
        </aside>

        {/* Main content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ChipBar labelFor={(id) => tagNameMap.get(id) ?? id} />
          <AssetGrid tagIds={selectedIds} />
        </main>
      </div>
    </div>
  );
}
