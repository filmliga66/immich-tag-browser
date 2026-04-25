// SPDX-License-Identifier: AGPL-3.0-or-later
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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

  // Single group (OR within group): standard infinite scroll
  const singleIds = tagGroups[0] ?? [];
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['assets', singleIds],
    queryFn: ({ pageParam }) => searchAssets(singleIds, pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.assets.nextPage !== null ? (lastPageParam as number) + 1 : undefined,
    enabled: enabled && !multiGroup,
    staleTime: 60_000,
  });

  // Multi-group: fetch full result set per group, then AND-intersect across groups.
  // Immich's tagIds is natively OR, so one request per group covers OR-within-group.
  const intersectQuery = useQuery({
    queryKey: ['assets-and', tagGroups],
    queryFn: async () => {
      const fetchGroup = async (ids: string[]): Promise<AssetMetadata[]> => {
        if (ids.length === 1) return fetchAllAssetsForTag(ids[0] as string);
        const all: AssetMetadata[] = [];
        let p = 1;
        while (p <= 20) {
          const res = await searchAssets(ids, p, 250);
          all.push(...res.assets.items);
          if (res.assets.nextPage === null) break;
          p++;
        }
        return all;
      };

      const perGroup = await Promise.all(tagGroups.map(fetchGroup));

      // Intersect starting from the smallest group result for efficiency
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

  return {
    pages: (infiniteQuery.data?.pages ?? []).map((p) => p.assets.items),
    hasNextPage: infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    isLoading: infiniteQuery.isLoading && enabled,
    isError: infiniteQuery.isError,
  };
}
