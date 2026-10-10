'use client';

import type { ConfirmExtractedValues, LabResultView } from '@healthguard/shared';
import { FileSearch } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';

type Decision = ConfirmExtractedValues['results'][number]['decision'];

/**
 * Values read from an uploaded report are shown for the patient to check
 * against the paper. Only confirmed values are used in trends and summaries.
 */
export function ConfirmReport({ patientId }: { patientId: string }) {
  const t = useTranslations('tests');
  const locale = useLocale();
  const query = useApi<LabResultView[]>(`/patients/${patientId}/lab-results`);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const pending = (query.data ?? []).filter((row) => row.awaitingConfirmation && row.documentId);
  const documentId = pending[0]?.documentId ?? null;
  const send = useAction(
    () =>
      api<{ confirmed: number; reported: number }>(
        `/patients/${patientId}/documents/${documentId}/confirm-values`,
        {
          method: 'POST',
          json: {
            results: pending
              .filter((row) => decisions[row.id])
              .map((row) => ({ labResultId: row.id, decision: decisions[row.id] })),
          },
        },
      ),
    [`/patients/${patientId}`],
  );
  if (send.isSuccess && pending.length === 0) {
    return <Alert tone="ok">{t('confirmedThanks')}</Alert>;
  }
  if (!documentId) return null;
  const rows = pending.filter((row) => row.documentId === documentId);
  const complete = rows.every((row) => decisions[row.id]);
  return (
    <Card className="border-warn/40">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FileSearch aria-hidden className="size-4 text-warn" /> {t('confirmTitle')}
          </span>
        }
        subtitle={t('confirmIntro')}
      />
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2.5 text-sm"
          >
            <span>
              <span className="font-medium">{row.test.name}</span>:{' '}
              {formatNumber(row.valueNumeric, 2)} {row.unit}
              <span className="block text-xs text-muted">
                {formatDate(row.effectiveAt, locale)}
                {row.extractionConfidence !== null
                  ? ` · ${t('readConfidence', { percent: Math.round(row.extractionConfidence * 100) })}`
                  : ''}
              </span>
            </span>
            <span className="flex gap-1" role="radiogroup" aria-label={row.test.name}>
              {(['MATCHES_REPORT', 'DOES_NOT_MATCH'] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  role="radio"
                  aria-checked={decisions[row.id] === decision}
                  onClick={() => setDecisions((current) => ({ ...current, [row.id]: decision }))}
                  className={`min-h-10 rounded-lg border px-3 text-sm ${decisions[row.id] === decision ? (decision === 'MATCHES_REPORT' ? 'border-ok bg-ok-50 text-ok' : 'border-danger bg-danger-50 text-danger') : 'border-line bg-white'}`}
                >
                  {t(decision === 'MATCHES_REPORT' ? 'matches' : 'doesNotMatch')}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {send.error ? <ErrorState error={send.error} /> : null}
      <Button className="mt-3" disabled={!complete || send.isPending} onClick={() => send.mutate()}>
        {t('submitCheck')}
      </Button>
    </Card>
  );
}
