'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * A write to the API. On success it refreshes every cached GET whose path
 * starts with one of `refresh` (or everything with `['*']`).
 */
export function useAction<TInput = void, TResult = unknown>(
  run: (input: TInput) => Promise<TResult>,
  refresh: string[] = ['*'],
) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TInput>({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            refresh.includes('*') ||
            (typeof key === 'string' && refresh.some((prefix) => key.startsWith(prefix)))
          );
        },
      });
    },
  });
}

/** A fresh idempotency key for one user action (a retry reuses it). */
export function newRequestKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
