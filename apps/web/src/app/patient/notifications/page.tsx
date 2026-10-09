'use client';

import type { NotificationView } from '@healthguard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ComingNextPhase } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const client = useQueryClient();
  const query = useApi<NotificationView[]>('/notifications');
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['/notifications'] }),
  });
  return (
    <div className="grid gap-4">
      <PageHeader title={t('title')} action={<ComingNextPhase label={t('inAppOnly')} />} />
      <Card>
        <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.title}</p>
                    <p className="text-sm text-muted">{row.body}</p>
                    <p className="text-xs text-muted">{formatDate(row.scheduledFor, locale)}</p>
                  </div>
                  {row.readAt ? (
                    <Badge>{t('read')}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(row.id)}
                    >
                      {t('markRead')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Card>
    </div>
  );
}
