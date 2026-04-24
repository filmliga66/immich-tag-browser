// SPDX-License-Identifier: AGPL-3.0-or-later

export interface AssetMetadata {
  id: string;
  type: string;
  originalFileName: string;
  exifInfo?: {
    exifImageWidth?: number | null;
    exifImageHeight?: number | null;
  } | null;
}

export interface SearchMetadataResponse {
  assets: {
    items: AssetMetadata[];
    nextPage: string | null;
  };
}

export async function searchAssets(
  tagIds: string[],
  page: number,
  size: number,
): Promise<SearchMetadataResponse> {
  const res = await fetch('/api/search/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tagIds, page, size }),
  });
  if (res.status === 401) throw new Error('unauthenticated');
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json() as Promise<SearchMetadataResponse>;
}

/**
 * Fetches all assets for a single tag by draining all pages, up to maxPages.
 * Used for AND intersection: Immich's tagIds field is OR, so we must fetch
 * each tag's full result set separately and intersect client-side.
 */
export async function fetchAllAssetsForTag(
  tagId: string,
  maxPages = 20,
  pageSize = 250,
): Promise<AssetMetadata[]> {
  const all: AssetMetadata[] = [];
  let page = 1;
  while (page <= maxPages) {
    const res = await searchAssets([tagId], page, pageSize);
    all.push(...res.assets.items);
    if (res.assets.nextPage === null) break;
    page++;
  }
  return all;
}
