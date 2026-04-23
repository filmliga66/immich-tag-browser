// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TagNode } from '@immich-tag-browser/shared';
import clsx from 'clsx';

interface TagTreeProps {
  nodes: TagNode[];
  /** Selected tag *values* (full Immich tag paths) — unique & stable across loads. */
  selectedValues: Set<string>;
  query: string;
  onToggle: (value: string) => void;
}

/** Returns true if node or any descendant matches the query. */
function nodeMatchesQuery(node: TagNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some((c) => nodeMatchesQuery(c, q));
}

interface TagRowProps {
  node: TagNode;
  selectedValues: Set<string>;
  query: string;
  depth: number;
  expanded: Set<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  onToggle: (value: string) => void;
  listRef: React.RefObject<HTMLElement | null>;
}

function TagRow({
  node,
  selectedValues,
  query,
  depth,
  expanded,
  setExpanded,
  onToggle,
  listRef,
}: TagRowProps): JSX.Element | null {
  const lq = query.toLowerCase();
  if (lq !== '' && !nodeMatchesQuery(node, lq)) return null;

  const isSelected = selectedValues.has(node.value);
  const hasChildren = node.children.length > 0;
  // While searching, auto-expand so matches nested deeper are visible.
  const isOpen = lq !== '' ? true : expanded.has(node.id);

  function toggleOpen(e: React.MouseEvent): void {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }

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
    } else if (e.key === 'ArrowRight' && hasChildren && !isOpen) {
      e.preventDefault();
      setExpanded((prev) => new Set(prev).add(node.id));
    } else if (e.key === 'ArrowLeft' && hasChildren && isOpen) {
      e.preventDefault();
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(node.value);
    }
  }

  return (
    <>
      <li
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        tabIndex={0}
        onClick={() => onToggle(node.value)}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: `${depth * 1 + 0.25}rem` }}
        className={clsx(
          'flex cursor-pointer select-none items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-immich-primary',
          isSelected
            ? 'bg-immich-primary/10 font-medium text-immich-primary dark:bg-immich-primary/20 dark:text-immich-dark-primary'
            : 'text-immich-gray-700 hover:bg-immich-gray-100 dark:text-immich-gray-300 dark:hover:bg-immich-gray-800',
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={toggleOpen}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-immich-gray-500 hover:bg-immich-gray-200 dark:text-immich-gray-400 dark:hover:bg-immich-gray-700"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={clsx('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')}
            >
              <path d="M7 5l6 5-6 5V5z" />
            </svg>
          </button>
        ) : (
          <span className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{node.name}</span>
      </li>
      {hasChildren && isOpen && (
        <>
          {node.children.map((child) => (
            <TagRow
              key={child.id}
              node={child}
              selectedValues={selectedValues}
              query={query}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              onToggle={onToggle}
              listRef={listRef}
            />
          ))}
        </>
      )}
    </>
  );
}

export function TagTree({ nodes, selectedValues, query, onToggle }: TagTreeProps): JSX.Element {
  const listRef = useRef<HTMLUListElement | null>(null);
  // Start with every branch collapsed — the user opts in by clicking.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  return (
    <ul
      ref={listRef}
      role="tree"
      aria-label="Tag tree"
      className="flex-1 overflow-y-auto px-1 py-1"
    >
      {nodes.map((node) => (
        <TagRow
          key={node.id}
          node={node}
          selectedValues={selectedValues}
          query={query}
          depth={0}
          expanded={expanded}
          setExpanded={setExpanded}
          onToggle={onToggle}
          listRef={listRef}
        />
      ))}
    </ul>
  );
}
