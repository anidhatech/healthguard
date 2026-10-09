'use client';

import { Inbox, Loader2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { Alert } from './alert';
import { Button } from './button';

export function LoadingState({ label }: { label?: string }) {
  const t = useTranslations('states');
  return (
    <div
      className="flex items-center gap-2 py-6 text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 aria-hidden className="size-4 animate-spin" /> {label ?? t('loading')}
    </div>
  );
}

export function EmptyState({ children }: { children?: ReactNode }) {
  const t = useTranslations('states');
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-8 text-center text-sm text-muted">
      <Inbox aria-hidden className="size-5" />
      {children ?? t('empty')}
    </div>
  );
}

/** Shows API problems clearly; access denials explain the reason instead of looking like a bug. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations('states');
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <Alert tone="warn" title={error.status === 403 ? t('accessDenied') : t('notFound')}>
        <span className="flex items-start gap-2">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {error.message}
            {error.problem.reason ? (
              <span className="ml-1 font-mono text-xs">({error.problem.reason})</span>
            ) : null}
          </span>
        </span>
      </Alert>
    );
  }
  return (
    <Alert tone="danger" title={t('error')}>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      {error instanceof ApiError && error.problem.requestId ? (
        <p className="mt-1 font-mono text-xs">
          {t('requestId')}: {error.problem.requestId}
        </p>
      ) : null}
      {onRetry ? (
        <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : null}
    </Alert>
  );
}

/** Renders loading / error / empty around a query's data. */
export function QueryView<T>({
  query,
  isEmpty,
  children,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <LoadingState />;
  if (isEmpty?.(query.data)) return <EmptyState />;
  return <>{children(query.data)}</>;
}
