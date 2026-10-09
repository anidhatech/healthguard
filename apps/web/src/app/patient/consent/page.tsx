'use client';

import type { AccessLogEntry, ConsentView } from '@healthguard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useApi } from '@/lib/queries';
import { formatDate, formatTime } from '@/lib/utils';

function Consents({ patientId }: { patientId: string }) {
  const t = useTranslations('consent');
  const tc = useTranslations('categories');
  const locale = useLocale();
  const client = useQueryClient();
  const query = useApi<ConsentView[]>(`/patients/${patientId}/consents`);
  const [target, setTarget] = useState<ConsentView | null>(null);
  const revoke = useMutation({
    mutationFn: (consentId: string) =>
      api(`/patients/${patientId}/consents/${consentId}/revoke`, { method: 'POST' }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries();
    },
  });
  return (
    <>
      {revoke.isSuccess ? <Alert tone="ok" title={t('withdrawn')} className="mb-3" /> : null}
      {revoke.error ? <ErrorState error={revoke.error} /> : null}
      <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
        {(rows) => (
          <ul className="grid gap-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    {row.isActiveNow ? (
                      <ShieldCheck aria-hidden className="size-4 text-ok" />
                    ) : (
                      <ShieldOff aria-hidden className="size-4 text-muted" />
                    )}
                    {row.purpose.name}
                  </p>
                  <Badge tone={row.isActiveNow ? 'ok' : 'neutral'}>
                    {row.isActiveNow
                      ? t('active')
                      : `${t('inactive')} (${row.status.toLowerCase()})`}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {row.grantee.displayName} ·{' '}
                  {t('validUntil', { date: formatDate(row.validUntil, locale) })}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {t('categories')}: {row.categories.map((category) => tc(category)).join(', ')}
                </p>
                {row.isActiveNow ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => setTarget(row)}
                  >
                    {t('withdraw')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t('withdrawTitle')}
        description={target ? t('withdrawBody', { purpose: target.purpose.name }) : undefined}
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">{t('cancel')}</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() => target && revoke.mutate(target.id)}
          >
            {t('confirm')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function AccessLog({ patientId }: { patientId: string }) {
  const t = useTranslations('consent');
  const locale = useLocale();
  const query = useApi<AccessLogEntry[]>(`/patients/${patientId}/access-log`);
  return (
    <QueryView query={query} isEmpty={(rows) => rows.length === 0}>
      {(rows) => (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-nowrap">
                  {formatDate(row.occurredAt, locale)} {formatTime(row.occurredAt, locale)}
                </Td>
                <Td>
                  {row.actor.isPatient ? t('you') : row.actor.displayName}
                  <span className="block text-xs text-muted">{row.actor.roles.join(', ')}</span>
                </Td>
                <Td>
                  {row.action.replaceAll('_', ' ').toLowerCase()} · {row.resourceType}
                  {row.purposeCode ? (
                    <span className="block text-xs text-muted">{row.purposeCode}</span>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={row.decision === 'DENY' ? 'danger' : 'ok'}>
                    {row.decision === 'DENY' ? t('denied') : t('allowed')}
                  </Badge>
                  {row.decision === 'DENY' && row.decisionReason ? (
                    <span className="block text-xs text-muted">{row.decisionReason}</span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </QueryView>
  );
}

export default function ConsentPage() {
  const t = useTranslations('consent');
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-4">
          <PageHeader title={t('title')} subtitle={t('intro')} />
          <Consents patientId={patientId} />
          <Card>
            <CardHeader title={t('accessLog')} subtitle={t('accessLogIntro')} />
            <AccessLog patientId={patientId} />
          </Card>
        </div>
      )}
    </OwnPatient>
  );
}
