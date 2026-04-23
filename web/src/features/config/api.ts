// SPDX-License-Identifier: AGPL-3.0-or-later

export interface AppConfig {
  immichUrl: string;
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch('/config', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load config (${res.status})`);
  return res.json() as Promise<AppConfig>;
}
