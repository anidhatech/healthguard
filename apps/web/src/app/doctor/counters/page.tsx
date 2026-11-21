'use client';

import type { CounterList, CounterView, QueueEntryView } from '@healthguard/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ABHA_FIELD, problemText } from '@/lib/abha';
import { api } from '@/lib/api';
import { useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';

const COUNTERS = '/counters';

/** The counter's QR code, drawn in the browser from the address ABDM's patient app opens. */
function CounterQr({ url, label }: { url: string; label: string }) {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(url, { margin: 2, width: 320 }).then((data) => {
      if (current) setImage(data);
    });
    return () => {
      current = false;
    };
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a served image
  return image ? <img src={image} alt={label} width={160} height={160} /> : null;
}

function CounterCard({ counter }: { counter: CounterView }) {
  const t = useTranslations('counters');
  const client = useQueryClient();
  const path = `${COUNTERS}/${counter.id}/queue`;
  const queue = useApi<QueueEntryView[]>(path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(entryId: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`${COUNTERS}/queue/${entryId}/close`, { method: 'POST' });
      await client.invalidateQueries({ queryKey: [path] });
      await client.invalidateQueries({ queryKey: [COUNTERS] });
    } catch (caught) {
      setError(problemText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`${counter.name} · ${counter.code}`}
        subtitle={t('waiting', { count: counter.waiting })}
      />
      <div className="grid gap-4 text-sm sm:grid-cols-[auto_1fr]">
        <div className="grid content-start gap-2">
          {counter.qrUrl ? (
            <>
              <CounterQr url={counter.qrUrl} label={t('qrAlt', { code: counter.code })} />
              <span className="max-w-40 text-xs text-muted">{t('qrHint')}</span>
            </>
          ) : (
            <span className="max-w-40 text-xs text-muted">{t('noFacilityQr')}</span>
          )}
        </div>
        <div className="grid content-start gap-2">
          {queue.data?.length ? (
            <ul className="grid gap-2">
              {queue.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <span>
                    <span className="font-semibold">
                      {t('token', { number: entry.tokenNumber })}
                    </span>{' '}
                    <Link href={`/doctor/patient/${entry.patient.id}`} className="text-brand-700">
                      {entry.patient.displayName}
                    </Link>{' '}
                    <span className="font-mono text-xs text-muted">{entry.patient.mrn}</span>
                    {entry.replyStatus === 'FAILED' ? (
                      <span className="block text-danger">{t('replyFailed')}</span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void close(entry.id)}
                  >
                    {t('markSeen')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t('nobodyWaiting')}</p>
          )}
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * Counters and their queues. A patient scans a counter's QR code in their own
 * ABHA app and agrees to share; they then appear here, already registered,
 * with a token number. Nothing is typed at the desk.
 */
export default function CountersPage() {
  const t = useTranslations('counters');
  const { data: session } = useSession();
  const client = useQueryClient();
  const mayUse =
    session?.roles.some((role) => ['FRONT_DESK', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ??
    false;
  const isDemo = session?.activeOrganization?.isDemo ?? false;
  const list = useApi<CounterList>(COUNTERS, { enabled: mayUse && !isDemo });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The queue changes when a patient scans, not when the desk acts: look again every few seconds.
  useEffect(() => {
    if (!mayUse || isDemo) return;
    const timer = setInterval(() => void client.invalidateQueries(), 10_000);
    return () => clearInterval(timer);
  }, [client, mayUse, isDemo]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api(COUNTERS, { method: 'POST', json: { code: code.trim(), name: name.trim() } });
      setCode('');
      setName('');
      await client.invalidateQueries({ queryKey: [COUNTERS] });
    } catch (caught) {
      setError(problemText(caught));
    } finally {
      setBusy(false);
    }
  }

  if (isDemo || !mayUse) {
    return (
      <div className="grid max-w-2xl gap-5">
        <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
        <Alert tone="warn" title={isDemo ? t('demoTitle') : t('notAllowedTitle')}>
          {isDemo ? t('demoBody') : t('notAllowedBody')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid max-w-4xl gap-5">
      <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
      {list.data && !list.data.facilityId ? (
        <Alert tone="warn" title={t('noFacilityTitle')}>
          {t('noFacilityBody')}
        </Alert>
      ) : null}
      {list.data && list.data.facilityId && !list.data.sharingOn ? (
        <Alert tone="warn" title={t('sharingOffTitle')}>
          {t('sharingOffBody')}
        </Alert>
      ) : null}
      {list.error ? <Alert tone="danger">{problemText(list.error)}</Alert> : null}

      {list.data?.counters.map((counter) => (
        <CounterCard key={counter.id} counter={counter} />
      ))}

      <Card>
        <CardHeader title={t('addTitle')} subtitle={t('addSubtitle')} />
        <form
          className="grid items-end gap-3 text-sm sm:grid-cols-[1fr_2fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <label className="grid gap-1">
            <span className="font-medium">{t('code')}</span>
            <input
              required
              maxLength={20}
              pattern="[A-Za-z0-9]{1,20}"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${ABHA_FIELD} font-mono`}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-medium">{t('name')}</span>
            <input
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={ABHA_FIELD}
            />
          </label>
          <Button type="submit" disabled={busy || !code.trim() || !name.trim()}>
            {t('add')}
          </Button>
          <span className="text-xs text-muted sm:col-span-3">{t('codeHint')}</span>
          {error ? (
            <div className="sm:col-span-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
