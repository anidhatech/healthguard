'use client';

import type { AllergyView, ConditionView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function ConditionsList({ patientId }: { patientId: string }) {
  const locale = useLocale();
  const query = useApi<ConditionView[]>(`/patients/${patientId}/conditions`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3 text-sm"
            >
              <span>
                <span className="font-medium">{row.display}</span>
                {row.code ? (
                  <span className="ml-1 text-xs text-muted">
                    {row.codeSystem} {row.code}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {row.onsetDate ? formatDate(row.onsetDate, locale) : null}
                <Badge tone={row.clinicalStatus === 'ACTIVE' ? 'brand' : 'neutral'}>
                  {row.clinicalStatus.toLowerCase()}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

export function AllergiesList({ patientId }: { patientId: string }) {
  const t = useTranslations('records');
  const query = useApi<AllergyView[]>(`/patients/${patientId}/allergies`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="grid gap-2" aria-label={t('allergies')}>
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-danger/30 bg-danger-50 p-3 text-sm"
            >
              <p className="font-medium text-danger">
                {row.substance}{' '}
                {row.criticality === 'HIGH' ? <Badge tone="danger">high criticality</Badge> : null}
              </p>
              {row.reaction ? <p className="text-muted">{row.reaction}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}
