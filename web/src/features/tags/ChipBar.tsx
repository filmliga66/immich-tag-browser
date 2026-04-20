// SPDX-License-Identifier: AGPL-3.0-or-later
import { useSearchParams } from 'react-router-dom';

/** Parses ?tags=id1,id2 from the URL, returns an empty array when absent. */
export function useSelectedTagIds(): string[] {
  const [params] = useSearchParams();
  const raw = params.get('tags');
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

interface ChipBarProps {
  /** Display name for each tag id — falls back to the id if unknown. */
  labelFor: (id: string) => string;
}

export function ChipBar({ labelFor }: ChipBarProps): JSX.Element {
  const [params, setParams] = useSearchParams();
  const selectedIds = useSelectedTagIds();

  function removeTag(id: string): void {
    const next = selectedIds.filter((t) => t !== id);
    const updated = new URLSearchParams(params);
    if (next.length === 0) {
      updated.delete('tags');
    } else {
      updated.set('tags', next.join(','));
    }
    setParams(updated, { replace: true });
  }

  if (selectedIds.length === 0) return <div className="h-8" />;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2" aria-label="Selected tags">
      {selectedIds.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-800"
        >
          {labelFor(id)}
          <button
            type="button"
            aria-label={`Remove tag ${labelFor(id)}`}
            onClick={() => removeTag(id)}
            className="ml-0.5 rounded-full hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
