'use client';

import type {
  AppointmentView,
  CareQueueItem,
  ClinicianView,
  CompleteFollowUp,
  ProposeAppointment,
} from '@healthguard/shared';
import { CalendarPlus, PhoneCall } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { formatDate, formatTime } from '@/lib/utils';

const OUTCOMES = ['CALLED_RESOLVED', 'CALLED_ESCALATED_TO_DOCTOR', 'NO_ANSWER_CLOSED'] as const;

/** Staff propose a time; the patient approves in the app before it is confirmed. */
export function ProposeAppointmentButton({
  patientId,
  followUpId,
  defaultReason,
}: {
  patientId: string;
  followUpId?: string;
  defaultReason?: string;
}) {
  const t = useTranslations('care');
  const [open, setOpen] = useState(false);
  const clinicians = useApi<ClinicianView[]>(open ? '/clinicians' : null);
  const [form, setForm] = useState({
    clinicianId: '',
    date: '',
    time: '10:00',
    mode: 'IN_PERSON' as ProposeAppointment['mode'],
    reason: defaultReason ?? '',
  });
  const propose = useAction(
    () =>
      api(`/patients/${patientId}/appointments`, {
        method: 'POST',
        json: {
          clinicianId: form.clinicianId,
          startAt: new Date(`${form.date}T${form.time}:00+05:30`).toISOString(),
          durationMinutes: 20,
          mode: form.mode,
          reason: form.reason,
          ...(followUpId ? { followUpId } : {}),
        },
      }),
    ['/care-queue', `/patients/${patientId}`, '/appointments'],
  );
  const input = 'min-h-10 rounded-lg border border-line px-2';
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden className="size-4" /> {t('propose')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) propose.reset();
        }}
        title={t('proposeTitle')}
        description={t('proposeHint')}
      >
        {propose.isSuccess ? (
          <Alert tone="ok">{t('proposed')}</Alert>
        ) : (
          <form
            className="grid gap-3 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              propose.mutate();
            }}
          >
            <label className="grid gap-1">
              <span className="font-medium">{t('clinician')}</span>
              <select
                required
                className={input}
                value={form.clinicianId}
                onChange={(event) => setForm({ ...form, clinicianId: event.target.value })}
              >
                <option value="">—</option>
                {(clinicians.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="font-medium">{t('date')}</span>
                <input
                  required
                  type="date"
                  className={input}
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">{t('time')}</span>
                <input
                  required
                  type="time"
                  className={input}
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="font-medium">{t('mode')}</span>
              <select
                className={input}
                value={form.mode}
                onChange={(event) =>
                  setForm({ ...form, mode: event.target.value as ProposeAppointment['mode'] })
                }
              >
                {(['IN_PERSON', 'VIDEO', 'PHONE'] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`modes.${mode}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-medium">{t('reason')}</span>
              <input
                required
                minLength={2}
                maxLength={120}
                className={input}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </label>
            {propose.error ? <ErrorState error={propose.error} /> : null}
            <Button type="submit" disabled={propose.isPending}>
              {t('send')}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function CompleteButton({ item }: { item: CareQueueItem }) {
  const t = useTranslations('care');
  const [open, setOpen] = useState(false);
  const complete = useAction(
    (outcome: CompleteFollowUp['outcome']) =>
      api(`/care-queue/${item.id}/complete`, { method: 'POST', json: { outcome } }),
    ['/care-queue', '/patients'],
  );
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PhoneCall aria-hidden className="size-4" /> {t('complete')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('completeTitle')}
        description={item.reason}
      >
        <div className="grid gap-2">
          {OUTCOMES.map((outcome) => (
            <Button
              key={outcome}
              variant="secondary"
              disabled={complete.isPending}
              onClick={() => complete.mutate(outcome, { onSuccess: () => setOpen(false) })}
            >
              {t(`outcomes.${outcome}`)}
            </Button>
          ))}
          {complete.error ? <ErrorState error={complete.error} /> : null}
        </div>
      </Dialog>
    </>
  );
}

/** Call-backs and due follow-ups for the care team. */
export function CareQueue() {
  const t = useTranslations('care');
  const locale = useLocale();
  const query = useApi<CareQueueItem[]>('/care-queue');
  return (
    <Card>
      <CardHeader title={t('queueTitle')} subtitle={t('queueHint')} />
      <QueryView query={query}>
        {(items) =>
          items.length === 0 ? (
            <p className="text-sm text-muted">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="grid gap-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      <Link className="underline" href={`/doctor/patient/${item.patient.id}`}>
                        {item.patient.displayName}
                      </Link>{' '}
                      <span className="font-mono text-xs text-muted">{item.patient.mrn}</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Badge
                        tone={
                          item.origin === 'PATIENT_REQUEST'
                            ? 'brand'
                            : item.origin === 'RULE'
                              ? 'calc'
                              : 'neutral'
                        }
                      >
                        {t(`origins.${item.origin}`)}
                      </Badge>
                      <Badge tone={item.overdue ? 'danger' : 'warn'}>
                        {item.overdue
                          ? t('overdue')
                          : t('due', { date: formatDate(item.dueDate, locale) })}
                      </Badge>
                    </span>
                  </div>
                  <p>{item.reason}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {t(`types.${item.type}`)}
                      {item.assignedTo ? ` · ${t('assigned', { name: item.assignedTo })}` : ''}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {item.type === 'VISIT' || item.type === 'REPEAT_TEST' ? (
                        <ProposeAppointmentButton
                          patientId={item.patient.id}
                          followUpId={item.id}
                          defaultReason={item.type === 'VISIT' ? t('visitReason') : t('testReason')}
                        />
                      ) : (
                        <CompleteButton item={item} />
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
    </Card>
  );
}

/** A patient's appointments for staff, with confirm (after the patient approved) and cancel. */
export function StaffAppointments({ patientId }: { patientId: string }) {
  const t = useTranslations('care');
  const ta = useTranslations('appointments');
  const locale = useLocale();
  const query = useApi<AppointmentView[]>(`/patients/${patientId}/appointments`);
  const refresh = [`/patients/${patientId}`, '/appointments', '/care-queue'];
  const confirm = useAction(
    (id: string) => api(`/patients/${patientId}/appointments/${id}/confirm`, { method: 'POST' }),
    refresh,
  );
  const cancel = useAction(
    (id: string) =>
      api(`/patients/${patientId}/appointments/${id}/cancel`, {
        method: 'POST',
        json: { reason: 'CLINICIAN_UNAVAILABLE' },
      }),
    refresh,
  );
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="divide-y divide-line text-sm">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">
                  {formatDate(row.startAt, locale)} · {formatTime(row.startAt, locale)}
                </span>
                <span className="block text-muted">
                  {row.reason} · {row.clinician.displayName}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    row.status === 'CONFIRMED'
                      ? 'ok'
                      : row.status === 'PATIENT_APPROVED'
                        ? 'warn'
                        : 'neutral'
                  }
                >
                  {ta(`statuses.${row.status}`)}
                </Badge>
                {row.status === 'PATIENT_APPROVED' ? (
                  <Button
                    size="sm"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate(row.id)}
                  >
                    {t('confirm')}
                  </Button>
                ) : null}
                {row.status === 'PROPOSED' ? (
                  <span className="text-xs text-muted">{t('waitingForPatient')}</span>
                ) : null}
                {['PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED'].includes(row.status) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(row.id)}
                  >
                    {t('cancelAppointment')}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}
