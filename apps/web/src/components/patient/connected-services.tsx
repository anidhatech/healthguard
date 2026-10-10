'use client';

import type { AbdmSimulationView, DeviceSyncResult } from '@healthguard/shared';
import { Download, Link2, RefreshCw, Unlink, Watch } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';

/** Downloads the FHIR R4 Bundle of the records the signed-in user may see. */
export function FhirExportButton({ patientId }: { patientId: string }) {
  const t = useTranslations('share');
  const download = useAction(async () => {
    const bundle = await api<{ entry: unknown[] }>(`/patients/${patientId}/fhir/export`);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `healthguard-fhir-${patientId.slice(0, 8)}-SYNTHETIC.json`;
    link.click();
    URL.revokeObjectURL(url);
    return bundle.entry.length;
  }, []);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>
        <Download aria-hidden className="size-4" /> {t('exportFhir')}
      </Button>
      {download.data !== undefined ? (
        <span className="text-xs text-muted">{t('exported', { count: download.data })}</span>
      ) : null}
      {download.error ? <ErrorState error={download.error} /> : null}
    </span>
  );
}

/** The ABDM flow as a labelled simulation. No network, no ABHA data. */
export function AbdmSimulation({ patientId }: { patientId: string }) {
  const t = useTranslations('share');
  const locale = useLocale();
  const base = `/patients/${patientId}/abdm-simulation`;
  const query = useApi<AbdmSimulationView>(base);
  const [preview, setPreview] = useState<{ count: number; types: string[] } | null>(null);
  const link = useAction(() => api(`${base}/link`, { method: 'POST' }), [base]);
  const unlink = useAction(async () => {
    setPreview(null);
    return api(`${base}/unlink`, { method: 'POST' });
  }, [base]);
  const share = useAction(async () => {
    const result = await api<{ bundle: { entry: { resource: { resourceType: string } }[] } }>(
      `${base}/share-preview`,
    );
    const types = [...new Set(result.bundle.entry.map((entry) => entry.resource.resourceType))];
    setPreview({ count: result.bundle.entry.length, types });
    return result;
  }, []);
  return (
    <Card className="border-dashed border-warn/50">
      <CardHeader
        title={t('abdmTitle')}
        action={<Badge tone="warn">{t('simulatedLabel')}</Badge>}
      />
      <QueryView query={query}>
        {(view) => (
          <div className="grid gap-3 text-sm">
            <Alert tone="warn">{view.notice}</Alert>
            {view.linked ? (
              <p>
                {t('linkedAs', { address: view.simulatedAddress ?? '' })}{' '}
                <span className="text-muted">({formatDate(view.linkedAt, locale)})</span>
              </p>
            ) : null}
            <div>
              <p className="font-medium">
                {t('careContexts', { count: view.careContexts.length })}
              </p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {view.careContexts.slice(0, 5).map((context) => (
                  <li key={context.id}>
                    {context.display} · {formatDate(context.date, locale)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {view.linked ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={share.isPending}
                    onClick={() => share.mutate()}
                  >
                    {t('previewShare')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate()}
                  >
                    <Unlink aria-hidden className="size-4" /> {t('unlink')}
                  </Button>
                </>
              ) : (
                <Button disabled={link.isPending} onClick={() => link.mutate()}>
                  <Link2 aria-hidden className="size-4" /> {t('link')}
                </Button>
              )}
            </div>
            {preview ? (
              <Alert tone="info" title={t('previewTitle', { count: preview.count })}>
                {t('previewBody', { types: preview.types.join(', ') })}
              </Alert>
            ) : null}
            {[link.error, unlink.error, share.error].map((error, index) =>
              error ? <ErrorState key={index} error={error} /> : null,
            )}
          </div>
        )}
      </QueryView>
    </Card>
  );
}

/** Sync from the synthetic wearable (demo device). */
export function DeviceSync({ patientId }: { patientId: string }) {
  const t = useTranslations('activity');
  const sync = useAction(
    () => api<DeviceSyncResult>(`/patients/${patientId}/devices/sync`, { method: 'POST' }),
    [`/patients/${patientId}`],
  );
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate()}>
        {sync.isPending ? (
          <RefreshCw aria-hidden className="size-4 animate-spin" />
        ) : (
          <Watch aria-hidden className="size-4" />
        )}
        {t('syncDevice')}
      </Button>
      {sync.data ? (
        <span className="text-xs text-muted">
          {t('synced', { days: sync.data.daysAdded, steps: formatNumber(sync.data.todaySteps) })}
        </span>
      ) : (
        <span className="text-xs text-muted">{t('deviceNotice')}</span>
      )}
      {sync.error ? <ErrorState error={sync.error} /> : null}
    </span>
  );
}
