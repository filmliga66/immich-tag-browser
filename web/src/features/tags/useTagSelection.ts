// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const PARAM = 'tags';

export interface TagSelection {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function write(prev: URLSearchParams, next: string[]): URLSearchParams {
  const p = new URLSearchParams(prev);
  if (next.length === 0) p.delete(PARAM);
  else p.set(PARAM, next.join(','));
  return p;
}

/**
 * Selection state lives in the URL (`?tags=a,b`). AND is the only mode in v1,
 * so no `mode` param is emitted. Mutations read the current URL inside the
 * `setSearchParams` updater so two calls in the same tick compose correctly
 * rather than clobbering each other with stale closures.
 */
export function useTagSelection(): TagSelection {
  const [params, setParams] = useSearchParams();

  const selected = useMemo(() => parse(params.get(PARAM)), [params]);
  const isSelected = useCallback((id: string) => selected.includes(id), [selected]);

  const toggle = useCallback(
    (id: string) => {
      setParams(
        (prev) => {
          const current = parse(prev.get(PARAM));
          const next = current.includes(id)
            ? current.filter((s) => s !== id)
            : [...current, id];
          return write(prev, next);
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const remove = useCallback(
    (id: string) => {
      setParams(
        (prev) => write(prev, parse(prev.get(PARAM)).filter((s) => s !== id)),
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams((prev) => write(prev, []), { replace: true });
  }, [setParams]);

  return { selected, isSelected, toggle, remove, clear };
}
