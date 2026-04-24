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
 * Fetches assets matching ALL selected tags (AND semantics).
 *
 * Immich's /api/search/metadata accepts tagIds with OR semantics, so for a
 * single tag we use paginated accumulation. For multiple tags we fetch the
 * full result set for each tag separately, intersect by asset ID, and return
 * the intersection as a single flat list.
 */
export function useAssetsQuery(tagIds: string[]): AssetsQueryResult {
  const enabled = tagIds.length > 0;
  const multiTag = tagIds.length > 1;

  const tagKey = tagIds.join(',');
  const [page, setPage] = useState(1);
  // Accumulated pages for single-tag infinite scroll
  const [accumulated, setAccumulated] = useState<AssetMetadata[][]>([]);
  const lastTagKey = useRef(tagKey);

  useEffect(() => {
    if (lastTagKey.current !== tagKey) {
      lastTagKey.current = tagKey;
      setPage(1);
      setAccumulated([]);
    }
  }, [tagKey]);

  // Multi-tag: fetch all assets per tag then intersect (true AND semantics).
  // Immich's tagIds is OR, so we must resolve each tag separately.
  const intersectQuery = useQuery({
    queryKey: ['assets-and', tagIds],
    queryFn: async () => {
      const perTag = await Promise.all(tagIds.map((id) => fetchAllAssetsForTag(id)));
      const sorted = [...perTag].sort((a, b) => a.length - b.length);
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
    enabled: enabled && multiTag,
    staleTime: 60_000,
  });

  // Single-tag: paginated, accumulate pages for infinite scroll
  const singleQuery = useQuery({
    queryKey: ['assets', tagIds, page],
    queryFn: async () => {
      const result = await searchAssets(tagIds, page, PAGE_SIZE);
      setAccumulated((prev) => {
        const next = [...prev];
        next[page - 1] = result.assets.items;
        return next;
      });
      return result;
    },
    enabled: enabled && !multiTag,
    staleTime: 60_000,
  });

  if (multiTag) {
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
