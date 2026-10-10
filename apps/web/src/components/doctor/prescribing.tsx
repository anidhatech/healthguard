'use client';

import {
  NOTE_PHRASE_CODES,
  PRESCRIBABLE_TIMINGS,
  type DraftPlanRequest,
  type MedicationCatalogueItem,
  type MedicationPlanView,
  type PlanReview,
  type StopPlanRequest,
} from '@healthguard/shared';
import { CheckCircle2, FilePenLine, OctagonX, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';

const OFFSET_TIMINGS = new Set(['ACM', 'PCM', 'ACV', 'PCV']);
const LOCALE_NAMES: Record<string, string> = {
  'en-IN': 'English',
  'hi-IN': 'हिन्दी',
  'te-IN': 'తెలుగు',
};

/** The checks and the instruction in every language; the prescriber signs from here. */
export function PlanReviewView({ patientId, review }: { patientId: string; review: PlanReview }) {
  const t = useTranslations('prescribe');
  const [readAll, setReadAll] = useState(false);
  const base = `/patients/${patientId}/medication-plans/${review.plan.id}`;
  const refresh = [`/patients/${patientId}`];
  const sign = useAction(
    () => api<PlanReview>(`${base}/sign`, { method: 'POST', json: { instructionsReviewed: true } }),
    refresh,
  );
  const discard = useAction(() => api(`${base}/discard`, { method: 'POST' }), refresh);
  const plan = review.plan;
  const signed = sign.data?.plan.status === 'ACTIVE';
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-base font-semibold">
        {plan.medication.genericName} {plan.medication.strength} ·{' '}
        {t('version', { version: plan.version })}
        <Badge tone={signed ? 'ok' : 'warn'} className="ml-2">
          {signed ? t('signedBadge') : t('draftBadge')}
        </Badge>
      </p>
      <ul className="grid gap-1" aria-label={t('checks')}>
        {review.checks.map((check, index) => (
          <li key={index} className="flex items-start gap-2">
            {check.severity === 'BLOCK' ? (
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
            )}
            <span className={check.severity === 'BLOCK' ? 'text-danger' : undefined}>
              {check.message}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2">
        <p className="font-medium">{t('instructions')}</p>
        {review.instructions.map((instruction) => (
          <div key={instruction.id} className="rounded-lg border border-line p-2.5">
            <p className="text-xs text-muted">
              {LOCALE_NAMES[instruction.locale] ?? instruction.locale} · {instruction.templateKey}
            </p>
            <p lang={instruction.locale.slice(0, 2)}>{instruction.doseText || '—'}</p>
            {instruction.notesText ? (
              <p className="text-muted" lang={instruction.locale.slice(0, 2)}>
                {instruction.notesText}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">{review.limitations}</p>
      {signed ? (
        <Alert tone="ok">{t('signedDone')}</Alert>
      ) : review.canSign ? (
        <div className="grid gap-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={readAll}
              onChange={(event) => setReadAll(event.target.checked)}
            />
            <span>{t('readAllLanguages')}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!readAll || sign.isPending} onClick={() => sign.mutate()}>
              <FilePenLine aria-hidden className="size-4" /> {t('sign')}
            </Button>
            <Button variant="ghost" disabled={discard.isPending} onClick={() => discard.mutate()}>
              {t('discard')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Alert tone="danger" title={t('blocked')} />
          <Button variant="secondary" disabled={discard.isPending} onClick={() => discard.mutate()}>
            {t('discard')}
          </Button>
        </div>
      )}
      {sign.error ? <ErrorState error={sign.error} /> : null}
      {discard.error ? <ErrorState error={discard.error} /> : null}
    </div>
  );
}

/** Draft a new plan, or a new version of an active one. */
export function PrescribeButton({
  patientId,
  replaces,
  label,
}: {
  patientId: string;
  replaces?: MedicationPlanView;
  label?: string;
}) {
  const t = useTranslations('prescribe');
  const [open, setOpen] = useState(false);
  const catalogue = useApi<MedicationCatalogueItem[]>(open ? '/medications' : null);
  const initialForm = (): DraftPlanRequest => ({
    medicationId: replaces?.medication.id ?? '',
    doseQuantity: replaces?.doseQuantity ?? 1,
    timingEvent:
      (replaces?.timingEvents[0] as DraftPlanRequest['timingEvent'] | undefined) ?? 'PCM',
    timingOffsetMinutes: replaces?.timingOffsetMinutes ?? 15,
    durationDays: replaces ? replaces.durationDays : 90,
    indication: replaces?.indication ?? '',
    notePhrases: [],
    ...(replaces ? { replacesPlanId: replaces.id } : {}),
  });
  const [form, setForm] = useState<DraftPlanRequest>(initialForm);
  const draft = useAction(
    () =>
      api<PlanReview>(`/patients/${patientId}/medication-plans/drafts`, {
        method: 'POST',
        json: form,
      }),
    [`/patients/${patientId}/medication-plans/drafts`],
  );
  const set = <K extends keyof DraftPlanRequest>(key: K, value: DraftPlanRequest[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const input = 'min-h-10 rounded-lg border border-line px-2';
  return (
    <>
      <Button
        size={replaces ? 'sm' : 'md'}
        variant={replaces ? 'secondary' : 'primary'}
        onClick={() => setOpen(true)}
      >
        <FilePenLine aria-hidden className="size-4" /> {label ?? t('newPlan')}
      </Button>
      <Dialog
        wide
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            draft.reset();
            setForm(initialForm());
          }
        }}
        title={replaces ? t('changeTitle', { name: replaces.medication.genericName }) : t('title')}
        description={t('intro')}
      >
        {draft.data ? (
          <PlanReviewView patientId={patientId} review={draft.data} />
        ) : (
          <form
            className="grid gap-3 text-sm sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              draft.mutate();
            }}
          >
            <label className="grid gap-1 sm:col-span-2">
              <span className="font-medium">{t('medicine')}</span>
              <select
                required
                disabled={Boolean(replaces)}
                className={input}
                value={form.medicationId}
                onChange={(event) => set('medicationId', event.target.value)}
              >
                <option value="">{t('chooseMedicine')}</option>
                {(catalogue.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.genericName} {item.strength} ({item.form.toLowerCase()})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-medium">{t('quantity')}</span>
              <input
                type="number"
                min={0.5}
                max={4}
                step={0.5}
                className={input}
                value={form.doseQuantity}
                onChange={(event) => set('doseQuantity', Number(event.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-medium">{t('timing')}</span>
              <select
                className={input}
                value={form.timingEvent}
                onChange={(event) => {
                  const value = event.target.value as DraftPlanRequest['timingEvent'];
                  setForm((current) => ({
                    ...current,
                    timingEvent: value,
                    timingOffsetMinutes: OFFSET_TIMINGS.has(value)
                      ? current.timingOffsetMinutes
                      : null,
                  }));
                }}
              >
                {PRESCRIBABLE_TIMINGS.map((value) => (
                  <option key={value} value={value}>
                    {t(`timings.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {OFFSET_TIMINGS.has(form.timingEvent) ? (
              <label className="grid gap-1">
                <span className="font-medium">{t('offset')}</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  className={input}
                  value={form.timingOffsetMinutes ?? 0}
                  onChange={(event) =>
                    set('timingOffsetMinutes', Number(event.target.value) || null)
                  }
                />
              </label>
            ) : null}
            <label className="grid gap-1">
              <span className="font-medium">{t('duration')}</span>
              <input
                type="number"
                min={1}
                max={365}
                placeholder={t('ongoing')}
                className={input}
                value={form.durationDays ?? ''}
                onChange={(event) =>
                  set('durationDays', event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="font-medium">{t('indication')}</span>
              <input
                required
                minLength={2}
                maxLength={80}
                className={input}
                value={form.indication}
                onChange={(event) => set('indication', event.target.value)}
              />
            </label>
            <fieldset className="grid gap-1 sm:col-span-2">
              <legend className="mb-1 font-medium">{t('notes')}</legend>
              {NOTE_PHRASE_CODES.map((code) => (
                <label key={code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.notePhrases.includes(code)}
                    onChange={(event) =>
                      set(
                        'notePhrases',
                        event.target.checked
                          ? [...form.notePhrases, code]
                          : form.notePhrases.filter((item) => item !== code),
                      )
                    }
                  />
                  {t(`notePhrases.${code}`)}
                </label>
              ))}
              <span className="text-xs text-muted">{t('notesHint')}</span>
            </fieldset>
            {draft.error ? (
              <div className="sm:col-span-2">
                <ErrorState error={draft.error} />
              </div>
            ) : null}
            <Button
              type="submit"
              className="sm:col-span-2"
              disabled={draft.isPending || !form.medicationId}
            >
              {t('checkDraft')}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

/** Change (new version) or stop an active plan. */
export function PlanActions({ patientId, plan }: { patientId: string; plan: MedicationPlanView }) {
  const t = useTranslations('prescribe');
  const [stopOpen, setStopOpen] = useState(false);
  const stop = useAction(
    (reason: StopPlanRequest['reason']) =>
      api(`/patients/${patientId}/medication-plans/${plan.id}/stop`, {
        method: 'POST',
        json: { reason },
      }),
    [`/patients/${patientId}`],
  );
  if (plan.status !== 'ACTIVE') return null;
  return (
    <div className="flex flex-wrap gap-2">
      <PrescribeButton patientId={patientId} replaces={plan} label={t('change')} />
      <Button size="sm" variant="ghost" onClick={() => setStopOpen(true)}>
        <OctagonX aria-hidden className="size-4" /> {t('stop')}
      </Button>
      <Dialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title={t('stopTitle', { name: plan.medication.genericName })}
        description={t('stopHint')}
      >
        <div className="grid gap-2">
          {(
            [
              'COURSE_NOT_NEEDED',
              'SIDE_EFFECT_REPORTED',
              'CHANGED_TREATMENT',
              'ENTERED_IN_ERROR',
            ] as const
          ).map((reason) => (
            <Button
              key={reason}
              variant="secondary"
              disabled={stop.isPending}
              onClick={() => stop.mutate(reason, { onSuccess: () => setStopOpen(false) })}
            >
              {t(`stopReasons.${reason}`)}
            </Button>
          ))}
          {stop.error ? <ErrorState error={stop.error} /> : null}
        </div>
      </Dialog>
    </div>
  );
}

/** Unsigned drafts waiting for the prescriber. */
export function DraftsPanel({ patientId }: { patientId: string }) {
  const t = useTranslations('prescribe');
  const query = useApi<PlanReview[]>(`/patients/${patientId}/medication-plans/drafts`);
  if (!query.data?.length) return null;
  return (
    <Card className="border-warn/40">
      <CardHeader title={t('drafts')} />
      <QueryView query={query}>
        {(drafts) => (
          <ul className="grid gap-4">
            {drafts.map((review) => (
              <li key={review.plan.id} className="rounded-lg border border-line p-3">
                <PlanReviewView patientId={patientId} review={review} />
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Card>
  );
}
