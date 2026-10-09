'use client';

import type { ActivitySeries, VitalView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { TrendChart } from '@/components/charts/trend-chart';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { ComingNextPhase, KindBadge } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';

function Steps({ patientId }: { patientId: string }) {
  const t = useTranslations('activity');
  const locale = useLocale();
  const query = useApi<ActivitySeries>(`/patients/${patientId}/activity?metric=STEPS&days=120`);
  return (
    <QueryView query={query}>
      {(series) => (
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {t('average')}:{' '}
            <strong className="text-lg">{formatNumber(series.average.value)}</strong>{' '}
            <KindBadge kind="CALCULATED" />
          </p>
          <TrendChart
            points={series.points}
            unit="steps"
            label={t('steps')}
            average={series.average.value}
            locale={locale}
            digits={0}
          />
          <p className="text-xs text-muted">
            {t('source', { source: series.sourceSystems.join(', ') })}
          </p>
        </div>
      )}
    </QueryView>
  );
}

function Vitals({ patientId }: { patientId: string }) {
  const t = useTranslations('activity');
  const locale = useLocale();
  const query = useApi<VitalView[]>(`/patients/${patientId}/vitals`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => {
        const weights = rows.filter((row) => row.type === 'BODY_WEIGHT').reverse();
        const pressure = rows.filter((row) => row.type === 'BLOOD_PRESSURE').slice(0, 6);
        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">{t('weight')}</p>
              <TrendChart
                points={weights.map((row) => ({ date: row.measuredAt, value: row.value }))}
                unit="kg"
                label={t('weight')}
                locale={locale}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{t('bloodPressure')}</p>
              <ul className="divide-y divide-line text-sm">
                {pressure.map((row) => (
                  <li key={row.id} className="flex justify-between py-1.5">
                    <span>{formatDate(row.measuredAt, locale)}</span>
                    <span className="font-medium">
                      {row.value}/{row.value2} {row.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </QueryView>
  );
}

export default function ActivityPage() {
  const t = useTranslations('activity');
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-4">
          <PageHeader title={t('title')} action={<ComingNextPhase label={t('connectDevice')} />} />
          <Card>
            <CardHeader title={t('steps')} />
            <Steps patientId={patientId} />
          </Card>
          <Card>
            <Vitals patientId={patientId} />
          </Card>
        </div>
      )}
    </OwnPatient>
  );
}
