// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { fetchConfig, type AppConfig } from './api.js';

export function useConfigQuery(): AppConfig | undefined {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: Infinity,
  });
  return data;
}
