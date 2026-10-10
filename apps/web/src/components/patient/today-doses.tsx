'use client';

import {
  SNOOZE_MINUTES,
  type DoseResponseRequest,
  type SupportedLocale,
  type TodayDoseView,
} from '@healthguard/shared';
import { AlarmClock, Check, Pill, SkipForward } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { newRequestKey, useAction, useApi } from '@/lib/queries';
import { formatTime } from '@/lib/utils';
import { NeedHelp } from './need-help';
import { ReadAloud } from './read-aloud';

const SKIP_REASONS = ['FELT_UNWELL', 'RAN_OUT', 'FORGOT_TO_CARRY', 'OTHER'] as const;

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral' | 'brand'> = {
  TAKEN: 'ok',
  SKIPPED: 'warn',
  MISSED: 'danger',
  SNOOZED: 'brand',
  REMINDED: 'brand',
  SCHEDULED: 'neutral',
};

function DoseRow({ patientId, dose }: { patientId: string; dose: TodayDoseView }) {
  const t = useTranslations('doses');
  const tm = useTranslations('medications');
  const locale = useLocale() as SupportedLocale;
  const [skipOpen, setSkipOpen] = useState(false);
  // One key per intended answer, so a double tap or a retry is recorded once.
  const [keys] = useState(() => ({
    TAKEN: newRequestKey(),
    SKIPPED: newRequestKey(),
    SNOOZED: newRequestKey(),
  }));
  const respond = useAction(
    (body: DoseResponseRequest) =>
      api(`/patients/${patientId}/doses/${dose.id}/respond`, { method: 'POST', json: body }),
    [`/patients/${patientId}`, '/notifications'],
  );
  const late = dose.status === 'MISSED';
  return (
    <li className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Pill aria-hidden className="size-4 text-brand-700" />
          {formatTime(dose.scheduledAt, locale)} · {dose.medication}
        </p>
        <Badge tone={STATUS_TONE[dose.status] ?? 'neutral'}>
          {tm(`doseStatuses.${dose.status}`)}
          {dose.status === 'MISSED' && dose.missedInferred ? ` · ${t('noAnswer')}` : ''}
        </Badge>
      </div>
      {dose.instruction ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-base" lang={locale.slice(0, 2)}>
            {dose.instruction}
          </p>
          <ReadAloud text={dose.instruction} lang={locale} />
        </div>
      ) : null}
      {dose.canRespond ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={respond.isPending}
            onClick={() => respond.mutate({ action: 'TAKEN', idempotencyKey: keys.TAKEN })}
          >
            <Check aria-hidden className="size-4" /> {late ? t('takenLate') : t('taken')}
          </Button>
          <Button
            variant="secondary"
            disabled={respond.isPending}
            onClick={() => setSkipOpen(true)}
          >
            <SkipForward aria-hidden className="size-4" /> {t('skip')}
          </Button>
          {!late ? (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-sm text-muted">
                <AlarmClock aria-hidden className="mr-1 inline size-4" />
                {t('snoozeLabel')}
              </span>
              {SNOOZE_MINUTES.map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  variant="ghost"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate({
                      action: 'SNOOZED',
                      minutes,
                      idempotencyKey: `${keys.SNOOZED}-${minutes}-${dose.reminderCount}`,
                    })
                  }
                >
                  {t('snoozeFor', { minutes })}
                </Button>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {respond.error ? (
        <div className="mt-2">
          <ErrorState error={respond.error} />
        </div>
      ) : null}
      <Dialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        title={t('skipTitle')}
        description={t('skipHint')}
      >
        <div className="grid gap-2">
          {SKIP_REASONS.map((reason) => (
            <Button
              key={reason}
              variant="secondary"
              onClick={() => {
                respond.mutate({ action: 'SKIPPED', reason, idempotencyKey: keys.SKIPPED });
                setSkipOpen(false);
              }}
            >
              {t(`skipReasons.${reason}`)}
            </Button>
          ))}
        </div>
      </Dialog>
    </li>
  );
}

/** Today's doses with taken / skip / snooze, the reviewed instruction and read-aloud. */
export function TodayDoses({
  patientId,
  readOnly = false,
}: {
  patientId: string;
  readOnly?: boolean;
}) {
  const t = useTranslations('doses');
  const locale = useLocale();
  const query = useApi<TodayDoseView[]>(`/patients/${patientId}/doses/today?locale=${locale}`);
  return (
    <section aria-labelledby="today-doses" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-doses" className="font-semibold">
          {t('todayTitle')}
        </h2>
        {!readOnly ? <NeedHelp patientId={patientId} /> : null}
      </div>
      <QueryView query={query}>
        {(doses) =>
          doses.length === 0 ? (
            <p className="text-sm text-muted">{t('noneToday')}</p>
          ) : (
            <ul className="grid gap-2">
              {doses.map((dose) => (
                <DoseRow
                  key={dose.id}
                  patientId={patientId}
                  dose={readOnly ? { ...dose, canRespond: false } : dose}
                />
              ))}
            </ul>
          )
        }
      </QueryView>
      <p className="text-xs text-muted">{t('rulesNote')}</p>
    </section>
  );
}
