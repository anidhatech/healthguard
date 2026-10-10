'use client';

import type { AppointmentView, DemoState, NotificationView } from '@healthguard/shared';
import { Bell, CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { MedicationList } from '@/components/clinical/medication-list';
import { ProgressCards } from '@/components/clinical/progress-cards';
import { OwnPatient } from '@/components/layout/own-patient';
import { SimulatedPhone } from '@/components/patient/simulated-phone';
import { TodayDoses } from '@/components/patient/today-doses';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { formatDate, formatTime } from '@/lib/utils';

function NextAppointment({ patientId }: { patientId: string }) {
  const t = useTranslations('patient');
  const ta = useTranslations('appointments');
  const locale = useLocale();
  const query = useApi<AppointmentView[]>(`/patients/${patientId}/appointments`);
  return (
    <QueryView query={query}>
      {(rows) => {
        const next = rows
          .filter((row) => ['CONFIRMED', 'PATIENT_APPROVED', 'PROPOSED'].includes(row.status))
          .at(-1);
        return next ? (
          <div className="text-sm">
            <p className="text-lg font-semibold">
              {formatDate(next.startAt, locale)} · {formatTime(next.startAt, locale)}
            </p>
            <p>{ta('with', { name: next.clinician.displayName })}</p>
            <p className="text-muted">{next.reason}</p>
            <p className="mt-1 text-xs text-ok">{ta(`statuses.${next.status}`)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('noAppointment')}</p>
        );
      }}
    </QueryView>
  );
}

export default function PatientDashboard() {
  const t = useTranslations('patient');
  const tn = useTranslations('nav');
  const locale = useLocale();
  const { data: session } = useSession();
  const demo = useApi<DemoState>('/demo/state');
  const notifications = useApi<NotificationView[]>('/notifications');
  const unread = notifications.data?.filter((item) => !item.readAt).length ?? 0;
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-5">
          <PageHeader
            title={t('hello', { name: session?.user.displayName.split(' ')[0] ?? '' })}
            subtitle={
              demo.data
                ? t('today', { date: formatDate(demo.data.clock.today, locale) })
                : undefined
            }
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <TodayDoses patientId={patientId} />
            </Card>
            <SimulatedPhone />
          </div>
          <ProgressCards patientId={patientId} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={t('yourMedicines')}
                action={
                  <Link className="text-sm text-brand-700 underline" href="/patient/medications">
                    {t('seeAll')}
                  </Link>
                }
              />
              <MedicationList patientId={patientId} compact />
            </Card>
            <div className="grid gap-4">
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <CalendarDays aria-hidden className="size-4" />
                      {t('nextAppointment')}
                    </span>
                  }
                />
                <NextAppointment patientId={patientId} />
              </Card>
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Bell aria-hidden className="size-4" />
                      {tn('notifications')}
                    </span>
                  }
                  action={
                    <Link
                      className="text-sm text-brand-700 underline"
                      href="/patient/notifications"
                    >
                      {t('seeAll')}
                    </Link>
                  }
                />
                <p className="text-sm">{t('unread', { count: unread })}</p>
              </Card>
            </div>
          </div>
        </div>
      )}
    </OwnPatient>
  );
}
