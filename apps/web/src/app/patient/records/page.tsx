'use client';

import type { DocumentView, ImmunizationView, ProcedureView } from '@healthguard/shared';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AllergiesList, ConditionsList } from '@/components/clinical/history-panel';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { ComingNextPhase } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

function Procedures({ patientId }: { patientId: string }) {
  const locale = useLocale();
  const query = useApi<ProcedureView[]>(`/patients/${patientId}/procedures`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="font-medium">{row.display}</span> ·{' '}
              {formatDate(row.performedOn, locale)}
              {row.outcome ? <span className="text-muted"> · {row.outcome}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

function Immunizations({ patientId }: { patientId: string }) {
  const locale = useLocale();
  const query = useApi<ImmunizationView[]>(`/patients/${patientId}/immunizations`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="font-medium">{row.vaccineName}</span> ·{' '}
              {formatDate(row.occurredOn, locale)}
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

function Documents({ patientId }: { patientId: string }) {
  const locale = useLocale();
  const query = useApi<DocumentView[]>(`/patients/${patientId}/documents`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <ul className="grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-2">
              <FileText aria-hidden className="mt-0.5 size-4 text-muted" />
              <span>
                <span className="font-medium">{row.title}</span> ·{' '}
                {formatDate(row.documentDate, locale)}
                <span className="block text-xs text-muted">{row.download.note}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

export default function RecordsPage() {
  const t = useTranslations('records');
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-4">
          <PageHeader title={t('title')} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('conditions')} />
              <ConditionsList patientId={patientId} />
            </Card>
            <Card>
              <CardHeader title={t('allergies')} />
              <AllergiesList patientId={patientId} />
            </Card>
            <Card>
              <CardHeader title={t('procedures')} />
              <Procedures patientId={patientId} />
            </Card>
            <Card>
              <CardHeader title={t('immunizations')} />
              <Immunizations patientId={patientId} />
            </Card>
          </div>
          <Card>
            <CardHeader title={t('documents')} action={<ComingNextPhase label={t('upload')} />} />
            <Documents patientId={patientId} />
          </Card>
        </div>
      )}
    </OwnPatient>
  );
}
