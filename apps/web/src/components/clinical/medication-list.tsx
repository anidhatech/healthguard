'use client';

import type { AdherenceSummary, MedicationPlanView, SupportedLocale } from '@healthguard/shared';
import { Pill } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { KindBadge } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function MedicationList({
  patientId,
  compact = false,
}: {
  patientId: string;
  compact?: boolean;
}) {
  const t = useTranslations('medications');
  const locale = useLocale() as SupportedLocale;
  const query = useApi<MedicationPlanView[]>(
    `/patients/${patientId}/medication-plans?locale=${locale}`,
  );
  return (
    <QueryView query={query} isEmpty={(plans) => plans.length === 0}>
      {(plans) => (
        <ul className="grid gap-3">
          {(compact ? plans.filter((plan) => plan.status === 'ACTIVE') : plans).map((plan) => (
            <li key={plan.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Pill aria-hidden className="size-4 text-brand-700" />
                  {plan.medication.genericName} {plan.medication.strength}
                </p>
                <span className="flex gap-1.5">
                  <Badge tone={plan.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                    {t(`statuses.${plan.status}`)}
                  </Badge>
                  {!compact ? <KindBadge kind="FACT" /> : null}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium tracking-wide text-muted uppercase">
                {t('instruction')}
              </p>
              <p className="text-base" lang={plan.instruction?.locale.slice(0, 2)}>
                {plan.instruction?.doseText ?? t('noInstruction')}
              </p>
              {!compact ? (
                <p className="mt-2 text-xs text-muted">
                  {plan.prescriber
                    ? `${t('prescribedBy', { name: plan.prescriber.displayName })} · `
                    : ''}
                  {t('started', { date: formatDate(plan.startDate, locale) })}
                  {plan.endDate
                    ? ` · ${t('ended', { date: formatDate(plan.endDate, locale) })}`
                    : ''}
                  {plan.instruction ? ` · template ${plan.instruction.templateKey}` : ''}
                </p>
              ) : null}
              {plan.syntheticNotice && !compact ? (
                <p className="mt-1 text-xs text-warn">{plan.syntheticNotice}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

export function AdherenceCard({ patientId }: { patientId: string }) {
  const t = useTranslations('medications');
  const tp = useTranslations('patient');
  const query = useApi<AdherenceSummary>(`/patients/${patientId}/adherence`);
  return (
    <Card>
      <QueryView query={query}>
        {(summary) => (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t('adherence')}</h2>
              <KindBadge kind="CALCULATED" />
            </div>
            <p className="mt-2 text-3xl font-semibold">
              {summary.percentage === null ? '—' : `${summary.percentage}%`}
            </p>
            <p className="text-sm">{t('dosesTaken', { taken: summary.taken, due: summary.due })}</p>
            <p className="mt-1 text-xs text-muted">{tp('adherenceExplained')}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">{summary.formula}</p>
            {summary.perPlan.length > 1 ? (
              <ul className="mt-2 text-sm">
                {summary.perPlan.map((plan) => (
                  <li key={plan.planId}>
                    {plan.medication}: {plan.percentage ?? '—'}% ({plan.taken}/{plan.due})
                  </li>
                ))}
              </ul>
            ) : null}
            {summary.longestMissedRun >= 2 ? (
              <Alert tone="info" className="mt-3">
                Longest run of unconfirmed doses: {summary.longestMissedRun}
              </Alert>
            ) : null}
          </div>
        )}
      </QueryView>
    </Card>
  );
}
