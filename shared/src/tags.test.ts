// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { buildTagTree, type ImmichTag } from './tags.js';

const tag = (id: string, name: string, parentId: string | null = null): ImmichTag => ({
  id,
  name,
  value: name,
  parentId,
  color: null,
});

describe('buildTagTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTagTree([])).toEqual([]);
  });

  it('handles a flat list (all root nodes)', () => {
    const tags = [tag('a', 'Animals'), tag('b', 'Places'), tag('c', 'People')];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    for (const node of tree) {
      expect(node.children).toHaveLength(0);
    }
  });

  it('builds a nested tree from parent/child relationships', () => {
    const tags = [
      tag('animals', 'Animals'),
      tag('dog', 'Dog', 'animals'),
      tag('cat', 'Cat', 'animals'),
      tag('labrador', 'Labrador', 'dog'),
    ];
    const tree = buildTagTree(tags);

    expect(tree).toHaveLength(1);
    const animals = tree[0];
    if (animals === undefined) throw new Error('expected animals node');
    expect(animals.id).toBe('animals');
    expect(animals.children).toHaveLength(2);

    const dog = animals.children.find((n) => n.id === 'dog');
    expect(dog).toBeDefined();
    expect(dog?.children).toHaveLength(1);
    expect(dog?.children[0]?.id).toBe('labrador');

    const cat = animals.children.find((n) => n.id === 'cat');
    expect(cat?.children).toHaveLength(0);
  });

  it('promotes orphaned nodes (unknown parentId) to roots', () => {
    const tags = [
      tag('a', 'Animals'),
      tag('dog', 'Dog', 'nonexistent'),
    ];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'dog']);
  });

  it('handles multiple levels of nesting', () => {
    const tags = [
      tag('1', 'L1'),
      tag('2', 'L2', '1'),
      tag('3', 'L3', '2'),
      tag('4', 'L4', '3'),
    ];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.children[0]?.id).toBe('4');
  });

  it('does not mutate the input array', () => {
    const tags = [tag('a', 'A'), tag('b', 'B', 'a')];
    const copy = JSON.stringify(tags);
    buildTagTree(tags);
    expect(JSON.stringify(tags)).toBe(copy);
  });
});
