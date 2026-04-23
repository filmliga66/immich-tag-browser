// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichTag } from '@immich-tag-browser/shared';

export interface TagNode {
  tag: ImmichTag;
  children: TagNode[];
}

/**
 * Build a forest from a flat tag list. Nodes whose `parentId` references an
 * unknown tag are treated as roots so orphaned tags remain visible instead of
 * disappearing silently.
 */
export function buildForest(tags: readonly ImmichTag[]): TagNode[] {
  const byId = new Map<string, TagNode>();
  for (const tag of tags) {
    byId.set(tag.id, { tag, children: [] });
  }
  const roots: TagNode[] = [];
  for (const node of byId.values()) {
    const parent = node.tag.parentId ? byId.get(node.tag.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: TagNode[]): void => {
    nodes.sort((a, b) => a.tag.name.localeCompare(b.tag.name));
    for (const n of nodes) sort(n.children);
  };
  sort(roots);
  return roots;
}

/**
 * Filter the forest to nodes whose name (or any descendant's name) matches
 * `query`. Ancestors of a match are retained so the tree structure stays
 * readable.
 */
export function filterForest(roots: readonly TagNode[], query: string): TagNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...roots];
  const walk = (node: TagNode): TagNode | null => {
    const self = node.tag.name.toLowerCase().includes(q);
    const kept = node.children.map(walk).filter((c): c is TagNode => c !== null);
    if (self || kept.length > 0) return { tag: node.tag, children: kept };
    return null;
  };
  return roots.map(walk).filter((n): n is TagNode => n !== null);
}

/** Returns the set of ids that are descendants of `rootId` (exclusive). */
export function descendantIds(
  tags: readonly ImmichTag[],
  rootId: string,
): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const t of tags) {
    if (!t.parentId) continue;
    const bucket = byParent.get(t.parentId);
    if (bucket) bucket.push(t.id);
    else byParent.set(t.parentId, [t.id]);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) break;
    const kids = byParent.get(id);
    if (!kids) continue;
    for (const kid of kids) {
      if (!out.has(kid)) {
        out.add(kid);
        stack.push(kid);
      }
    }
  }
  return out;
}
