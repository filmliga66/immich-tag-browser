// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { buildTagTree, type TagNode } from '@immich-tag-browser/shared';
import { fetchTags } from './api.js';

export function useTagsQuery(): { tree: TagNode[]; isLoading: boolean; isError: boolean } {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 60_000,
  });

  return {
    tree: data !== undefined ? buildTagTree(data) : [],
    isLoading,
    isError,
  };
}
