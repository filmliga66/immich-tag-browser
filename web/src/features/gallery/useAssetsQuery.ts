// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchAssets, fetchAllAssetsForTag, type AssetMetadata } from './api.js';

const PAGE_SIZE = 50;

export interface AssetsQueryResult {
  pages: AssetMetadata[][];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Fetches assets matching the tag selection with grouped OR/AND semantics:
 *   - Tags in the same group (same parent) are combined with OR
 *   - Groups are combined with AND
 *
 * Example: [[Jahr/2012, Jahr/2013], [Veranstaltung/GV]] returns assets that
 * have (Jahr/2012 OR Jahr/2013) AND Veranstaltung/GV.
 *
 * Immich's /api/search/metadata tagIds field is natively OR, so one request
 * per group suffices; results are then intersected across groups.
 */
export function useAssetsQuery(tagGroups: string[][]): AssetsQueryResult {
  const totalTags = tagGroups.reduce((n, g) => n + g.length, 0);
  const enabled = totalTags > 0;
  const multiGroup = tagGroups.length > 1;
  // Single group with multiple tags or single tag — use paginated path
  const singleGroup = tagGroups.length === 1;

  const tagKey = tagGroups.map((g) => g.join('|')).join(',');
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<AssetMetadata[][]>([]);
  const lastTagKey = useRef(tagKey);

  useEffect(() => {
    if (lastTagKey.current !== tagKey) {
      lastTagKey.current = tagKey;
      setPage(1);
      setAccumulated([]);
    }
  }, [tagKey]);

  // Multi-group: one fetch per group (OR within group), then AND-intersect across groups.
  // fetchAllAssetsForTag fetches a single tag; for an OR group we use searchAssets directly.
  const intersectQuery = useQuery({
    queryKey: ['assets-and', tagGroups],
    queryFn: async () => {
      const fetchGroup = (ids: string[]) =>
        ids.length === 1
          ? fetchAllAssetsForTag(ids[0] as string)
          : // OR group: drain pages using the native tagIds OR behaviour
            (async () => {
              const all: AssetMetadata[] = [];
              let p = 1;
              while (p <= 20) {
                const res = await searchAssets(ids, p, 250);
                all.push(...res.assets.items);
                if (res.assets.nextPage === null) break;
                p++;
              }
              return all;
            })();

      const perGroup = await Promise.all(tagGroups.map(fetchGroup));

      // Intersect: start from smallest group result for efficiency
      const sorted = [...perGroup].sort((a, b) => a.length - b.length);
      const pivot = sorted[0];
      if (pivot === undefined) return [];
      const keepIds = new Set(pivot.map((a) => a.id));
      for (const assets of sorted.slice(1)) {
        const ids = new Set(assets.map((a) => a.id));
        for (const id of keepIds) {
          if (!ids.has(id)) keepIds.delete(id);
        }
      }
      return pivot.filter((a) => keepIds.has(a.id));
    },
    enabled: enabled && multiGroup,
    staleTime: 60_000,
  });

  // Single group (OR within group): paginated accumulation
  const singleIds = tagGroups[0] ?? [];
  const singleQuery = useQuery({
    queryKey: ['assets', singleIds, page],
    queryFn: async () => {
      const result = await searchAssets(singleIds, page, PAGE_SIZE);
      setAccumulated((prev) => {
        const next = [...prev];
        next[page - 1] = result.assets.items;
        return next;
      });
      return result;
    },
    enabled: enabled && singleGroup,
    staleTime: 60_000,
  });

  if (multiGroup) {
    const items = intersectQuery.data ?? [];
    return {
      pages: items.length > 0 ? [items] : [],
      hasNextPage: false,
      fetchNextPage: () => undefined,
      isFetchingNextPage: false,
      isLoading: intersectQuery.isLoading && enabled,
      isError: intersectQuery.isError,
    };
  }

  const hasNextPage = (singleQuery.data?.assets.nextPage ?? null) !== null;

  return {
    pages: accumulated,
    hasNextPage,
    fetchNextPage: () => setPage((p) => p + 1),
    isFetchingNextPage: singleQuery.isFetching && page > 1,
    isLoading: singleQuery.isLoading && enabled,
    isError: singleQuery.isError,
  };
}
