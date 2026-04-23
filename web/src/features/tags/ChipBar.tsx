// SPDX-License-Identifier: AGPL-3.0-or-later
import { useSearchParams } from 'react-router-dom';

/** Parses ?tags=name1,name2 from the URL, returns an empty array when absent. */
export function useSelectedTagValues(): string[] {
  const [params] = useSearchParams();
  const raw = params.get('tags');
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
}

interface ChipBarProps {
  /** Display label for each selected tag value. */
  labelFor: (value: string) => string;
}

export function ChipBar({ labelFor }: ChipBarProps): JSX.Element {
  const [params, setParams] = useSearchParams();
  const selected = useSelectedTagValues();

  function removeTag(value: string): void {
    const next = selected.filter((v) => v !== value);
    const updated = new URLSearchParams(params);
    if (next.length === 0) {
      updated.delete('tags');
    } else {
      updated.set('tags', next.map(encodeURIComponent).join(','));
    }
    setParams(updated, { replace: true });
  }

  if (selected.length === 0) return <div className="h-0" />;

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-immich-gray-200 bg-immich-bg px-4 py-2 dark:border-immich-gray-800 dark:bg-immich-dark-bg"
      aria-label="Selected tags"
    >
      {selected.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full bg-immich-primary/10 px-3 py-0.5 text-sm font-medium text-immich-primary dark:bg-immich-primary/20 dark:text-immich-dark-primary"
        >
          {labelFor(value)}
          <button
            type="button"
            aria-label={`Remove tag ${labelFor(value)}`}
            onClick={() => removeTag(value)}
            className="ml-0.5 rounded-full px-1 hover:bg-immich-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-immich-primary dark:hover:bg-immich-primary/30"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
