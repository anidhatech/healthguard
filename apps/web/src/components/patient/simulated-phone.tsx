'use client';

import type { NotificationView } from '@healthguard/shared';
import { Smartphone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatTime } from '@/lib/utils';

/**
 * The simulated phone: where SMS or WhatsApp reminders would arrive. In the
 * demo nothing is sent to a real phone; the reminder is shown here.
 */
export function SimulatedPhone() {
  const t = useTranslations('phone');
  const locale = useLocale();
  const query = useApi<NotificationView[]>('/notifications');
  return (
    <Card className="border-dashed">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Smartphone aria-hidden className="size-4" /> {t('title')}
          </span>
        }
        subtitle={t('notice')}
      />
      <QueryView query={query}>
        {(items) => {
          const phone = items.filter((item) => item.channel === 'SIMULATED_PHONE').slice(0, 3);
          return phone.length === 0 ? (
            <p className="text-sm text-muted">{t('empty')}</p>
          ) : (
            <ul
              className="mx-auto grid max-w-xs gap-2 rounded-2xl bg-ink/90 p-3"
              aria-live="polite"
            >
              {phone.map((item) => (
                <li key={item.id} className="rounded-xl bg-white p-2.5 text-sm">
                  <p className="flex justify-between gap-2 text-xs text-muted">
                    <span>HealthGuard</span>
                    <span>{formatTime(item.scheduledFor, locale)}</span>
                  </p>
                  <p className="font-semibold">{item.title}</p>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Card>
  );
}
