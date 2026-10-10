'use client';

import type {
  AppointmentRequest,
  AppointmentView,
  CancelAppointment,
  FollowUpView,
} from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { formatDate, formatTime } from '@/lib/utils';

const REQUEST_REASONS = ['FOLLOW_UP', 'NEW_PROBLEM', 'REPORT_REVIEW', 'OTHER'] as const;
const WINDOWS = ['THIS_WEEK', 'NEXT_WEEK', 'ANY_TIME'] as const;

function RequestVisit({ patientId }: { patientId: string }) {
  const t = useTranslations('appointments');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AppointmentRequest['reason']>('FOLLOW_UP');
  const [when, setWhen] = useState<AppointmentRequest['preferredWindow']>('THIS_WEEK');
  const send = useAction(
    () =>
      api(`/patients/${patientId}/appointment-requests`, {
        method: 'POST',
        json: { reason, preferredWindow: when },
      }),
    [`/patients/${patientId}`],
  );
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('request')}</Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) send.reset();
        }}
        title={t('requestTitle')}
        description={t('requestHint')}
      >
        {send.isSuccess ? (
          <Alert tone="ok">{t('requested')}</Alert>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t('reasonLabel')}</span>
              <select
                className="min-h-11 rounded-lg border border-line px-2"
                value={reason}
                onChange={(event) => setReason(event.target.value as AppointmentRequest['reason'])}
              >
                {REQUEST_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`requestReasons.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t('windowLabel')}</span>
              <select
                className="min-h-11 rounded-lg border border-line px-2"
                value={when}
                onChange={(event) =>
                  setWhen(event.target.value as AppointmentRequest['preferredWindow'])
                }
              >
                {WINDOWS.map((value) => (
                  <option key={value} value={value}>
                    {t(`windows.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {send.error ? <ErrorState error={send.error} /> : null}
            <Button type="submit" disabled={send.isPending}>
              {t('send')}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function AppointmentActions({ patientId, row }: { patientId: string; row: AppointmentView }) {
  const t = useTranslations('appointments');
  const base = `/patients/${patientId}/appointments/${row.id}`;
  const refresh = [`/patients/${patientId}`, '/notifications'];
  const approve = useAction(() => api(`${base}/approve`, { method: 'POST' }), refresh);
  const cancel = useAction(
    (reason: CancelAppointment['reason']) =>
      api(`${base}/cancel`, { method: 'POST', json: { reason } }),
    refresh,
  );
  const busy = approve.isPending || cancel.isPending;
  if (!['PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED'].includes(row.status)) return null;
  return (
    <div className="mt-2 grid gap-2">
      <div className="flex flex-wrap gap-2">
        {row.status === 'PROPOSED' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => approve.mutate()}>
              {t('approve')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => cancel.mutate('PATIENT_DECLINED')}
            >
              {t('decline')}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => cancel.mutate('PATIENT_CANNOT_ATTEND')}
          >
            {t('cannotAttend')}
          </Button>
        )}
      </div>
      {row.status === 'PATIENT_APPROVED' ? (
        <p className="text-xs text-muted">{t('waitingForClinic')}</p>
      ) : null}
      {approve.error ? <ErrorState error={approve.error} /> : null}
      {cancel.error ? <ErrorState error={cancel.error} /> : null}
    </div>
  );
}

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
      <PageHeader title={t('title')} action={<RequestVisit patientId={patientId} />} />
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
                  <Badge
                    tone={
                      row.status === 'CONFIRMED'
                        ? 'ok'
                        : row.status === 'PROPOSED'
                          ? 'warn'
                          : 'neutral'
                    }
                  >
                    {row.status === 'PROPOSED' ? t('awaitingYou') : t(`statuses.${row.status}`)}
                  </Badge>
                  <div className="w-full">
                    <AppointmentActions patientId={patientId} row={row} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Card>
      <Card>
        <CardHeader title={t('followUps')} />
        <FollowUps patientId={patientId} />
      </Card>
    </div>
  );
}
