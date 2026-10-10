'use client';

import type { LabResultView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { TrendChart } from '@/components/charts/trend-chart';
import { Badge } from '@/components/ui/badge';
import { KindBadge } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useApi } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';

export function LabsPanel({ patientId }: { patientId: string }) {
  const t = useTranslations('tests');
  const locale = useLocale();
  const query = useApi<LabResultView[]>(`/patients/${patientId}/lab-results`);
  const [selected, setSelected] = useState<string | null>(null);
  const tests = useMemo(() => {
    const map = new Map<string, LabResultView[]>();
    for (const row of query.data ?? [])
      map.set(row.test.code, [...(map.get(row.test.code) ?? []), row]);
    return map;
  }, [query.data]);
  const code = selected ?? (tests.has('HBA1C') ? 'HBA1C' : ([...tests.keys()][0] ?? null));
  const series = code ? [...(tests.get(code) ?? [])].reverse() : [];

  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('test')}>
            {[...tests.entries()].map(([testCode, results]) => (
              <button
                key={testCode}
                role="tab"
                type="button"
                aria-selected={testCode === code}
                onClick={() => setSelected(testCode)}
                className={`min-h-9 rounded-full border px-3 text-sm ${testCode === code ? 'border-brand-700 bg-brand-50 text-brand-700' : 'border-line bg-white'}`}
              >
                {results[0]?.test.name}
              </button>
            ))}
          </div>
          {series.length > 0 && series[0]?.valueNumeric !== null ? (
            <div>
              <p className="mb-1 text-sm font-medium">
                {t('trend', { test: series[0]?.test.name ?? '' })}
              </p>
              <TrendChart
                points={series
                  .filter((row) => row.valueNumeric !== null)
                  .map((row) => ({ date: row.effectiveAt, value: row.valueNumeric ?? 0 }))}
                unit={series[0]?.unit ?? ''}
                label={series[0]?.test.name ?? ''}
                referenceHigh={series[0]?.referenceHigh}
                locale={locale}
              />
            </div>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>{t('date')}</Th>
                <Th>{t('test')}</Th>
                <Th>{t('result')}</Th>
                <Th>{t('reference')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>{formatDate(row.effectiveAt, locale)}</Td>
                  <Td>
                    {row.test.name}
                    {row.test.loincCode ? (
                      <span className="ml-1 text-xs text-muted">LOINC {row.test.loincCode}</span>
                    ) : null}
                  </Td>
                  <Td className="font-medium">
                    {row.valueNumeric !== null ? formatNumber(row.valueNumeric, 2) : row.valueText}{' '}
                    {row.unit}
                  </Td>
                  <Td className="text-muted">
                    {row.referenceLow !== null || row.referenceHigh !== null
                      ? `${row.referenceLow ?? ''}–${row.referenceHigh ?? ''} ${row.unit}`
                      : '—'}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {row.interpretation === 'HIGH' ? (
                        <Badge tone="warn">{t('aboveRange')}</Badge>
                      ) : row.interpretation === 'LOW' ? (
                        <Badge tone="warn">{t('belowRange')}</Badge>
                      ) : row.interpretation === 'NORMAL' ? (
                        <Badge tone="ok">{t('inRange')}</Badge>
                      ) : null}
                      {row.awaitingConfirmation ? (
                        <Badge tone="warn">{t('notConfirmed')}</Badge>
                      ) : null}
                      <KindBadge kind="FACT" />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </QueryView>
  );
}
