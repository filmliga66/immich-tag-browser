// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichTag } from '@immich-tag-browser/shared';

export async function fetchTags(): Promise<ImmichTag[]> {
  const res = await fetch('/api/tags', { credentials: 'include' });
  if (res.status === 401) throw new Error('unauthenticated');
  if (!res.ok) throw new Error(`Failed to fetch tags (${res.status})`);
  return res.json() as Promise<ImmichTag[]>;
}
