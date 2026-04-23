// SPDX-License-Identifier: AGPL-3.0-or-later

/** A tag as returned by GET /api/tags. */
export interface ImmichTag {
  id: string;
  name: string;
  value: string;
  parentId: string | null;
  color?: string | null;
}

/** A tag node in the tree built from the flat list. */
export interface TagNode extends ImmichTag {
  children: TagNode[];
}

/**
 * Converts a flat Immich tag list into a forest (array of root nodes).
 *
 * Orphaned nodes (parentId references a non-existent tag) are promoted to
 * roots rather than silently dropped so they remain visible to the user.
 */
export function buildTagTree(tags: ImmichTag[]): TagNode[] {
  const nodeMap = new Map<string, TagNode>();

  for (const tag of tags) {
    nodeMap.set(tag.id, { ...tag, children: [] });
  }

  const roots: TagNode[] = [];

  for (const node of nodeMap.values()) {
    if (node.parentId === null || node.parentId === undefined) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent !== undefined) {
        parent.children.push(node);
      } else {
        // Orphaned node: parent does not exist in the list — promote to root.
        roots.push(node);
      }
    }
  }

  return roots;
}
