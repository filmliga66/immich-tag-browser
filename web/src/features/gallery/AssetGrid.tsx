// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAssetsQuery } from './useAssetsQuery.js';
import type { AssetMetadata } from './api.js';

interface AssetThumbProps {
  asset: AssetMetadata;
}

function AssetThumb({ asset }: AssetThumbProps): JSX.Element {
  return (
    <img
      src={`/api/assets/${asset.id}/thumbnail?size=preview`}
      alt={asset.originalFileName}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

interface AssetGridProps {
  tagIds: string[];
}

export function AssetGrid({ tagIds }: AssetGridProps): JSX.Element {
  const { pages, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading, isError } =
    useAssetsQuery(tagIds);

  if (tagIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p className="text-lg">Select tags to browse assets</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>Loading…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        <p>Failed to load assets.</p>
      </div>
    );
  }

  const allAssets = pages.flat();

  if (allAssets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>No assets match the selected tags.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
        {allAssets.map((asset) => (
          <div
            key={asset.id}
            className="aspect-square overflow-hidden rounded bg-gray-100"
          >
            <AssetThumb asset={asset} />
          </div>
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
