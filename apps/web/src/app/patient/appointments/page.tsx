'use client';

import type { AppointmentView, FollowUpView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ComingNextPhase } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate, formatTime } from '@/lib/utils';

function FollowUps({ patientId }: { patientId: string }) {
  const locale = useLocale();
  const query = useApi<FollowUpView[]>(`/patients/${patientId}/follow-ups`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="divide-y divide-line text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {row.reason} · {formatDate(row.dueDate, locale)}
              </span>
              <Badge tone={row.status === 'COMPLETED' ? 'ok' : 'brand'}>
                {row.status.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

export default function AppointmentsPage() {
  const t = useTranslations('appointments');
  const locale = useLocale();
  return (
    <OwnPatient>
      {(patientId) => <AppointmentsInner patientId={patientId} t={t} locale={locale} />}
    </OwnPatient>
  );
}

function AppointmentsInner({
  patientId,
  t,
  locale,
}: {
  patientId: string;
  t: ReturnType<typeof useTranslations<'appointments'>>;
  locale: string;
}) {
  const query = useApi<AppointmentView[]>(`/patients/${patientId}/appointments`);
  return (
    <div className="grid gap-4">
      <PageHeader title={t('title')} action={<ComingNextPhase label={t('request')} />} />
      <Card>
        <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {formatDate(row.startAt, locale)} · {formatTime(row.startAt, locale)}
                    </span>
                    <span className="block text-muted">
                      {row.reason} · {t('with', { name: row.clinician.displayName })}
                    </span>
                  </span>
                  <Badge tone={row.status === 'CONFIRMED' ? 'ok' : 'neutral'}>
                    {t(`statuses.${row.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Card>
      <Card>
        <CardHeader title="Follow-ups" />
        <FollowUps patientId={patientId} />
      </Card>
    </div>
  );
}
