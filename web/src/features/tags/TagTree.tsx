// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRef } from 'react';
import type { TagNode } from '@immich-tag-browser/shared';
import clsx from 'clsx';

interface TagTreeProps {
  nodes: TagNode[];
  selectedIds: Set<string>;
  query: string;
  onToggle: (id: string) => void;
}

/** Returns true if node or any descendant matches the query. */
function nodeMatchesQuery(node: TagNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some((c) => nodeMatchesQuery(c, q));
}

interface TagNodeItemProps {
  node: TagNode;
  selectedIds: Set<string>;
  query: string;
  depth: number;
  onToggle: (id: string) => void;
  listRef: React.RefObject<HTMLElement | null>;
}

function TagNodeItem({ node, selectedIds, query, depth, onToggle, listRef }: TagNodeItemProps): JSX.Element | null {
  const lq = query.toLowerCase();
  if (lq !== '' && !nodeMatchesQuery(node, lq)) return null;

  const isSelected = selectedIds.has(node.id);

  function handleKeyDown(e: React.KeyboardEvent<HTMLLIElement>): void {
    const list = listRef.current;
    if (!list) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const idx = items.indexOf(e.currentTarget);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[idx + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[idx - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(node.id);
    }
  }

  return (
    <li
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => onToggle(node.id)}
      onKeyDown={handleKeyDown}
      style={{ paddingLeft: `${depth * 1.25}rem` }}
      className={clsx(
        'flex cursor-pointer select-none items-center gap-1.5 rounded px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isSelected ? 'bg-blue-100 font-semibold text-blue-800' : 'hover:bg-gray-100 text-gray-800',
      )}
    >
      <span className="truncate">{node.name}</span>
    </li>
  );
}

function TagNodeWithChildren({
  node,
  selectedIds,
  query,
  depth,
  onToggle,
  listRef,
}: TagNodeItemProps): JSX.Element | null {
  const lq = query.toLowerCase();
  if (lq !== '' && !nodeMatchesQuery(node, lq)) return null;

  return (
    <>
      <TagNodeItem
        node={node}
        selectedIds={selectedIds}
        query={query}
        depth={depth}
        onToggle={onToggle}
        listRef={listRef}
      />
      {node.children.length > 0 && (
        <>
          {node.children.map((child) => (
            <TagNodeWithChildren
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              query={query}
              depth={depth + 1}
              onToggle={onToggle}
              listRef={listRef}
            />
          ))}
        </>
      )}
    </>
  );
}

export function TagTree({ nodes, selectedIds, query, onToggle }: TagTreeProps): JSX.Element {
  const listRef = useRef<HTMLUListElement | null>(null);

  return (
    <ul
      ref={listRef}
      role="tree"
      aria-label="Tag tree"
      className="overflow-y-auto flex-1 py-1"
    >
      {nodes.map((node) => (
        <TagNodeWithChildren
          key={node.id}
          node={node}
          selectedIds={selectedIds}
          query={query}
          depth={0}
          onToggle={onToggle}
          listRef={listRef}
        />
      ))}
    </ul>
  );
}
