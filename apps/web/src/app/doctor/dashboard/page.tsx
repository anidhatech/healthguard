'use client';

import type { AiStatus, DemoState, PatientListItem, ScheduleItem } from '@healthguard/shared';
import { Bot, CalendarClock, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { CareQueue } from '@/components/doctor/care-queue';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { QueryView } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { formatDate, formatTime } from '@/lib/utils';

export default function DoctorDashboard() {
  const t = useTranslations('doctor');
  const locale = useLocale();
  const { data: session } = useSession();
  const [scope, setScope] = useState<'my-care' | 'all'>(
    session?.roles.includes('DOCTOR') ? 'my-care' : 'all',
  );
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const demo = useApi<DemoState>('/demo/state');
  const schedule = useApi<ScheduleItem[]>('/appointments/schedule?clinician=all');
  const patients = useApi<PatientListItem[]>(
    `/patients?scope=${scope}${deferred ? `&search=${encodeURIComponent(deferred)}` : ''}`,
  );
  const ai = useApi<AiStatus>('/ai/status');

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t('title')}
        subtitle={demo.data ? formatDate(demo.data.clock.today, locale) : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CalendarClock aria-hidden className="size-4" />
                {t('schedule')}
              </span>
            }
          />
          <QueryView query={schedule} isEmpty={(rows) => rows.length === 0}>
            {(rows) => (
              <ul className="divide-y divide-line">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{formatTime(row.startAt, locale)}</span> ·{' '}
                      {row.patient.displayName}
                      <span className="ml-1 font-mono text-xs text-muted">{row.patient.mrn}</span>
                      <span className="block text-muted">
                        {row.reason} · {row.clinician.displayName}
                      </span>
                    </span>
                    <Link
                      href={`/doctor/patient/${row.patient.id}`}
                      className="rounded-md border border-line px-3 py-1.5 text-brand-700 hover:bg-brand-50"
                    >
                      {t('open')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bot aria-hidden className="size-4" />
                {t('aiStatus')}
              </span>
            }
          />
          <QueryView query={ai}>
            {(status) => (
              <div className="grid gap-1 text-sm">
                <p>{t('aiProvider', { provider: status.provider })}</p>
                <p>{t('aiFallback', { fallback: status.fallbackProvider })}</p>
                <p className="text-xs text-muted">{status.notice}</p>
                <p className="mt-1 text-xs text-muted">
                  Never: {status.prohibitedTasks.join(', ').toLowerCase().replaceAll('_', ' ')}
                </p>
              </div>
            )}
          </QueryView>
        </Card>
      </div>
      {session?.roles.some((role) => ['DOCTOR', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ? (
        <CareQueue />
      ) : null}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-surface p-1" role="tablist">
            {(['my-care', 'all'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={scope === value}
                onClick={() => setScope(value)}
                className={`min-h-9 rounded-md px-3 text-sm ${scope === value ? 'bg-white font-medium shadow-sm' : 'text-muted'}`}
              >
                {value === 'my-care' ? t('myPatients') : t('allPatients')}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">{t('search')}</span>
            <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search')}
              className="min-h-10 w-64 max-w-full rounded-md border border-line pr-3 pl-8 text-sm"
            />
          </label>
        </div>
        <QueryView query={patients} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>MRN</Th>
                  <Th>Age / sex</Th>
                  <Th>Primary clinician</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium">
                      {row.displayName}{' '}
                      {row.careRelationship ? <Badge tone="brand">{t('inCare')}</Badge> : null}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <Badge key={flag} tone={flag === 'MISSED_DOSES' ? 'danger' : 'warn'}>
                            {t(`flags.${flag}`)}
                          </Badge>
                        ))}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{row.mrn}</Td>
                    <Td>
                      {row.ageYears} · {row.sex.toLowerCase()}
                    </Td>
                    <Td>{row.primaryClinician?.displayName ?? '—'}</Td>
                    <Td>
                      <Link href={`/doctor/patient/${row.id}`} className="text-brand-700 underline">
                        {t('open')}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryView>
      </Card>
    </div>
  );
}
