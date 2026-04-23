// SPDX-License-Identifier: AGPL-3.0-or-later

export interface AssetMetadata {
  id: string;
  type: string;
  originalFileName: string;
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
