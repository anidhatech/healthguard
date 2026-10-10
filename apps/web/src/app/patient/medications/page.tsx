'use client';

import type { DoseEventView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { AdherenceCard, MedicationList } from '@/components/clinical/medication-list';
import { OwnPatient } from '@/components/layout/own-patient';
import { TodayDoses } from '@/components/patient/today-doses';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate, formatTime } from '@/lib/utils';

function RecentDoses({ patientId }: { patientId: string }) {
  const t = useTranslations('medications');
  const locale = useLocale();
  const query = useApi<DoseEventView[]>(`/patients/${patientId}/dose-events`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="divide-y divide-line text-sm">
          {rows.slice(0, 20).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {formatDate(row.scheduledAt, locale)} · {formatTime(row.scheduledAt, locale)} ·{' '}
                {row.medication}
              </span>
              <Badge
                tone={row.status === 'TAKEN' ? 'ok' : row.status === 'MISSED' ? 'danger' : 'warn'}
              >
                {t(`doseStatuses.${row.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

export default function MedicationsPage() {
  const t = useTranslations('medications');
  const tp = useTranslations('app');
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-5">
          <PageHeader title={t('title')} />
          <Alert tone="info">{tp('safety')}</Alert>
          <Card>
            <TodayDoses patientId={patientId} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MedicationList patientId={patientId} />
            </div>
            <AdherenceCard patientId={patientId} />
          </div>
          <Card>
            <CardHeader title={t('recentDoses')} />
            <RecentDoses patientId={patientId} />
          </Card>
        </div>
      )}
    </OwnPatient>
  );
}
