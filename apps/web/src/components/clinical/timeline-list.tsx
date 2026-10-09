'use client';

import type { TimelineView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function TimelineList({ patientId, limit }: { patientId: string; limit?: number }) {
  const t = useTranslations('timeline');
  const tc = useTranslations('categories');
  const locale = useLocale();
  const query = useApi<TimelineView>(`/patients/${patientId}/timeline`);
  return (
    <QueryView
      query={query}
      isEmpty={(view) => view.events.length === 0 && view.hiddenCategories.length === 0}
    >
      {(view) => (
        <div className="grid gap-3">
          {view.hiddenCategories.length ? (
            <Alert tone="warn">
              {t('hidden', {
                categories: view.hiddenCategories.map((category) => tc(category)).join(', '),
              })}
            </Alert>
          ) : null}
          <ol className="relative ml-2 border-l-2 border-brand-100">
            {(limit ? view.events.slice(0, limit) : view.events).map((event) => (
              <li key={event.id} className="mb-4 ml-4">
                <span
                  aria-hidden
                  className="absolute -left-[7px] mt-1.5 size-3 rounded-full border-2 border-white bg-brand-600"
                />
                <p className="text-xs text-muted">{formatDate(event.date, locale)}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {event.title} <Badge>{tc(event.category)}</Badge>
                </p>
                {event.detail ? <p className="text-sm text-muted">{event.detail}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </QueryView>
  );
}
