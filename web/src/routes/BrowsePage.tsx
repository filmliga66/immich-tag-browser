// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, logout } from '../features/auth/api.js';
import { useTagsQuery } from '../features/tags/useTagsQuery.js';
import { TagSearchBox } from '../features/tags/TagSearchBox.js';
import { TagTree } from '../features/tags/TagTree.js';
import { ChipBar, useSelectedTagValues } from '../features/tags/ChipBar.js';
import { AssetGrid } from '../features/gallery/AssetGrid.js';
import { useTheme } from '../features/theme/useTheme.js';

function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-md border border-immich-gray-200 bg-immich-bg px-3 py-1 text-sm text-immich-gray-700 hover:bg-immich-gray-100 dark:border-immich-gray-700 dark:bg-immich-gray-900 dark:text-immich-gray-300 dark:hover:bg-immich-gray-800"
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}

export function BrowsePage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tagQuery, setTagQuery] = useState('');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  const { tree, isLoading: tagsLoading, isError: isTagsError } = useTagsQuery();
  const selectedValues = useSelectedTagValues();
  const selectedValueSet = new Set(selectedValues);

  const valueToIdMap = new Map<string, string>();
  const valueToNameMap = new Map<string, string>();
  const valueToParentIdMap = new Map<string, string | null>();
  function indexTree(nodes: typeof tree): void {
    for (const node of nodes) {
      valueToIdMap.set(node.value, node.id);
      valueToNameMap.set(node.value, node.name);
      valueToParentIdMap.set(node.value, node.parentId);
      indexTree(node.children);
    }
  }
  indexTree(tree);

  // Group selected tags by parentId: OR within group, AND across groups.
  const groupMap = new Map<string | null, string[]>();
  for (const value of selectedValues) {
    const id = valueToIdMap.get(value);
    if (id === undefined) continue;
    const parentId = valueToParentIdMap.get(value) ?? null;
    const group = groupMap.get(parentId) ?? [];
    group.push(id);
    groupMap.set(parentId, group);
  }
  const tagGroups = [...groupMap.values()];

  function toggleTag(value: string): void {
    const next = new Set(selectedValueSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    const updated = new URLSearchParams(params);
    if (next.size === 0) {
      updated.delete('tags');
    } else {
      updated.set('tags', [...next].map(encodeURIComponent).join(','));
    }
    setParams(updated, { replace: true });
  }

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-immich-gray-50 text-immich-fg dark:bg-immich-dark-bg dark:text-immich-dark-fg">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-immich-gray-200 bg-immich-bg px-4 py-2 shadow-sm dark:border-immich-gray-800 dark:bg-immich-gray-900">
        <h1 className="text-lg font-semibold text-immich-gray-900 dark:text-immich-dark-fg">Immich Tag Browser</h1>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-immich-gray-500 dark:text-immich-gray-300">{user.name}</span>}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-md border border-immich-gray-200 bg-immich-bg px-3 py-1 text-sm text-immich-gray-700 hover:bg-immich-gray-100 dark:border-immich-gray-700 dark:bg-immich-gray-900 dark:text-immich-gray-300 dark:hover:bg-immich-gray-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-r border-immich-gray-200 bg-immich-bg dark:border-immich-gray-800 dark:bg-immich-gray-900">
          <TagSearchBox value={tagQuery} onChange={setTagQuery} />
          {tagsLoading ? (
            <p className="px-3 py-2 text-sm text-immich-gray-400 dark:text-immich-gray-400">Loading tags…</p>
          ) : isTagsError ? (
            <p className="px-3 py-2 text-sm text-red-500">Failed to load tags.</p>
          ) : tree.length === 0 ? (
            <p className="px-3 py-2 text-sm text-immich-gray-400 dark:text-immich-gray-400">No tags found. Create tags in Immich first.</p>
          ) : (
            <TagTree
              nodes={tree}
              selectedValues={selectedValueSet}
              query={tagQuery}
              onToggle={toggleTag}
            />
          )}
        </aside>

        {/* Main content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-immich-gray-50 dark:bg-immich-dark-bg">
          <ChipBar labelFor={(value) => valueToNameMap.get(value) ?? value} />
          <AssetGrid tagGroups={tagGroups} />
        </main>
      </div>
    </div>
  );
}
