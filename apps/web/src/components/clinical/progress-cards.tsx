'use client';

import type { ProgressSummary } from '@healthguard/shared';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { KindBadge } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';

const DIGITS: Record<string, number> = {
  HBA1C: 1,
  BODY_WEIGHT: 1,
  AVERAGE_DAILY_STEPS: 0,
  RECORDED_ADHERENCE: 0,
};

/** "Since the last visit": calculated comparisons with the method shown. */
export function ProgressCards({ patientId }: { patientId: string }) {
  const t = useTranslations('patient');
  const locale = useLocale();
  const query = useApi<ProgressSummary>(`/patients/${patientId}/progress`);
  return (
    <QueryView query={query}>
      {(summary) => (
        <section aria-labelledby="progress-heading">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="progress-heading" className="font-semibold">
              {t('sinceLastVisit')}
            </h2>
            <span className="flex items-center gap-2 text-xs text-muted">
              {summary.lastVisitDate
                ? t('lastVisitOn', { date: formatDate(summary.lastVisitDate, locale) })
                : null}
              <KindBadge kind="CALCULATED" />
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.metrics.map((metric) => {
              const digits = DIGITS[metric.metric] ?? 1;
              const unit =
                metric.unit === '%' ? '%' : metric.unit === 'steps' ? '' : ` ${metric.unit}`;
              const Icon =
                metric.direction === 'up'
                  ? ArrowUpRight
                  : metric.direction === 'down'
                    ? ArrowDownRight
                    : Minus;
              return (
                <li key={metric.metric} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-sm text-muted">{metric.label}</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">
                      {metric.after === null ? '—' : `${formatNumber(metric.after, digits)}${unit}`}
                    </span>
                    {metric.before !== null ? (
                      <span className="flex items-center gap-0.5 text-sm text-muted">
                        <Icon aria-hidden className="size-4" />
                        {t('before')}: {formatNumber(metric.before, digits)}
                        {unit}
                      </span>
                    ) : null}
                  </p>
                  {metric.after === null ? (
                    <p className="text-xs text-muted">{t('notEnoughData')}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">{metric.method}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </QueryView>
  );
}
