// SPDX-License-Identifier: AGPL-3.0-or-later
import { useInfiniteQuery } from '@tanstack/react-query';
import { searchAssets, type AssetMetadata } from './api.js';

const PAGE_SIZE = 50;

export interface AssetsQueryResult {
  pages: AssetMetadata[][];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useAssetsQuery(tagIds: string[]): AssetsQueryResult {
  const enabled = tagIds.length > 0;

  const query = useInfiniteQuery({
    queryKey: ['assets', tagIds],
    queryFn: ({ pageParam }) => searchAssets(tagIds, pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.assets.nextPage !== null) {
        return (lastPageParam as number) + 1;
      }
      return undefined;
    },
    enabled,
    staleTime: 60_000,
  });

  return {
    pages: (query.data?.pages ?? []).map((p) => p.assets.items),
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading && enabled,
    isError: query.isError,
  };
}
