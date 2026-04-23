// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import type { ImmichTag } from '@immich-tag-browser/shared';
import { buildForest, filterForest, descendantIds } from './tree.js';

function tag(id: string, name: string, parentId: string | null = null): ImmichTag {
  return { id, name, value: name, parentId };
}

describe('buildForest', () => {
  it('groups children under their parents', () => {
    const forest = buildForest([
      tag('a', 'Animals'),
      tag('b', 'Dog', 'a'),
      tag('c', 'Cat', 'a'),
      tag('d', '2024'),
    ]);
    expect(forest).toHaveLength(2);
    const animals = forest.find((n) => n.tag.id === 'a');
    expect(animals?.children.map((c) => c.tag.name)).toEqual(['Cat', 'Dog']);
  });

  it('sorts siblings alphabetically', () => {
    const forest = buildForest([tag('z', 'Zoo'), tag('a', 'Apple'), tag('m', 'Moon')]);
    expect(forest.map((n) => n.tag.name)).toEqual(['Apple', 'Moon', 'Zoo']);
  });

  it('treats orphans (unknown parentId) as roots', () => {
    const forest = buildForest([tag('b', 'Orphan', 'ghost')]);
    expect(forest).toHaveLength(1);
    expect(forest[0]?.tag.id).toBe('b');
  });
});

describe('filterForest', () => {
  const forest = buildForest([
    tag('a', 'Animals'),
    tag('b', 'Dog', 'a'),
    tag('c', 'Cat', 'a'),
    tag('d', '2024'),
    tag('e', 'Vacation', 'd'),
  ]);

  it('returns everything on empty query', () => {
    expect(filterForest(forest, '')).toHaveLength(2);
    expect(filterForest(forest, '   ')).toHaveLength(2);
  });

  it('keeps ancestors of a matching descendant', () => {
    const filtered = filterForest(forest, 'dog');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.tag.name).toBe('Animals');
    expect(filtered[0]?.children).toHaveLength(1);
    expect(filtered[0]?.children[0]?.tag.name).toBe('Dog');
  });

  it('matches case-insensitively', () => {
    expect(filterForest(forest, 'VACATION')).toHaveLength(1);
  });

  it('returns empty when nothing matches', () => {
    expect(filterForest(forest, 'zzz')).toEqual([]);
  });
});

describe('descendantIds', () => {
  const tags: ImmichTag[] = [
    tag('a', 'Animals'),
    tag('b', 'Dog', 'a'),
    tag('c', 'Cat', 'a'),
    tag('d', 'Retriever', 'b'),
    tag('e', '2024'),
  ];

  it('returns all transitive descendants, excluding the root', () => {
    expect(descendantIds(tags, 'a')).toEqual(new Set(['b', 'c', 'd']));
  });

  it('returns empty for leaves', () => {
    expect(descendantIds(tags, 'd')).toEqual(new Set());
  });

  it('returns empty for unknown ids', () => {
    expect(descendantIds(tags, 'ghost')).toEqual(new Set());
  });
});
