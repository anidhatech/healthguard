'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** A GET query keyed by its path. Disabled until every path part is known. */
export function useApi<T>(path: string | null, options: { enabled?: boolean } = {}) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path ?? ''),
    enabled: Boolean(path) && (options.enabled ?? true),
    retry: (count, error) =>
      count < 1 &&
      !(
        error instanceof Error &&
        'status' in error &&
        Number((error as { status: number }).status) < 500
      ),
  });
}
