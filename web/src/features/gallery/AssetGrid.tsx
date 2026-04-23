// SPDX-License-Identifier: AGPL-3.0-or-later
import 'photoswipe/dist/photoswipe.css';
import { Gallery, Item } from 'react-photoswipe-gallery';
import { VirtuosoGrid } from 'react-virtuoso';
import { useAssetsQuery } from './useAssetsQuery.js';
import { useConfigQuery } from '../config/useConfigQuery.js';
import type { AssetMetadata } from './api.js';

const FALLBACK_WIDTH = 1920;
const FALLBACK_HEIGHT = 1080;

function thumbDimensions(asset: AssetMetadata): { w: number; h: number } {
  const w = asset.exifInfo?.exifImageWidth ?? null;
  const h = asset.exifInfo?.exifImageHeight ?? null;
  return {
    w: typeof w === 'number' ? w : FALLBACK_WIDTH,
    h: typeof h === 'number' ? h : FALLBACK_HEIGHT,
  };
}

function SpinnerFooter(): JSX.Element {
  return (
    <div className="col-span-full flex justify-center py-4">
      <div className="h-6 w-6 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
    </div>
  );
}

interface AssetGridProps {
  tagIds: string[];
}

export function AssetGrid({ tagIds }: AssetGridProps): JSX.Element {
  const { pages, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading, isError } =
    useAssetsQuery(tagIds);
  const config = useConfigQuery();

  if (tagIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-lg">Select tags to browse assets</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
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
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
        <p>No assets match the selected tags.</p>
      </div>
    );
  }

  const immichUrl = config?.immichUrl ?? '';

  return (
    <Gallery withCaption>
      <VirtuosoGrid
        style={{ height: '100%', flex: 1 }}
        data={allAssets}
        overscan={600}
        endReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        listClassName="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 p-4"
        itemClassName="aspect-square"
        {...(isFetchingNextPage ? { components: { Footer: SpinnerFooter } } : {})}
        itemContent={(_index, asset) => {
          const { w, h } = thumbDimensions(asset);

          return (
            <Item
              original={`/api/assets/${asset.id}/original`}
              thumbnail={`/api/assets/${asset.id}/thumbnail?size=preview`}
              width={w}
              height={h}
              alt={asset.originalFileName}
              {...(immichUrl
                ? {
                    caption: `<a href="${immichUrl}/photos/${asset.id}" target="_blank" rel="noopener noreferrer">Open in Immich</a>`,
                  }
                : {})}
            >
              {({ ref, open }) => (
                <div
                  // ref is a callback ref from react-photoswipe-gallery, not a RefObject
                  ref={ref as unknown as React.RefObject<HTMLDivElement>}
                  onClick={open}
                  className="h-full w-full cursor-pointer overflow-hidden rounded bg-gray-100 dark:bg-gray-800"
                >
                  <img
                    src={`/api/assets/${asset.id}/thumbnail?size=preview`}
                    alt={asset.originalFileName}
                    loading="lazy"
                    className="h-full w-full object-cover transition-opacity duration-200 hover:opacity-90"
                  />
                </div>
              )}
            </Item>
          );
        }}
      />
    </Gallery>
  );
}
