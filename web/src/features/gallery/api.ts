// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichSearchResponse } from '@immich-tag-browser/shared';

export interface SearchParams {
  tagIds: string[];
  page?: number;
  size?: number;
}

export async function searchAssets({
  tagIds,
  page = 1,
  size = 100,
}: SearchParams): Promise<ImmichSearchResponse> {
  const res = await fetch('/api/search/metadata', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds, page, size, order: 'desc' }),
  });
  if (res.status === 401) throw new Error('unauthenticated');
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json() as Promise<ImmichSearchResponse>;
}

export function thumbnailUrl(assetId: string, size: 'preview' | 'thumbnail' = 'preview'): string {
  return `/api/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`;
}
