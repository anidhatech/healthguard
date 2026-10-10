'use client';

import type { DemoConsole, DemoState } from '@healthguard/shared';
import { Clock, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';

/** Presenter controls for the demo: story checkpoints, time of day, AI provider. */
export function DemoConsolePanel() {
  const t = useTranslations('demoConsole');
  const query = useApi<DemoConsole>('/demo/console');
  const router = useRouter();
  const client = useQueryClient();
  const [confirmDay, setConfirmDay] = useState<number | null>(null);
  const [time, setTime] = useState('08:10');
  const reset = useAction(
    (checkpointDay: number) => api('/demo/reset', { method: 'POST', json: { checkpointDay } }),
    [],
  );
  const clock = useAction(
    (timeOfDay: string | null) =>
      api<DemoState>('/demo/clock', { method: 'POST', json: { timeOfDay } }),
    ['*'],
  );
  const ai = useAction(
    (provider: 'DEMO' | 'ANTHROPIC') =>
      api<DemoConsole>('/demo/ai-provider', { method: 'POST', json: { provider } }),
    ['/demo', '/ai'],
  );
  return (
    <Card className="border-brand-700/30">
      <CardHeader title={t('title')} subtitle={t('intro')} />
      <QueryView query={query}>
        {(view) => (
          <div className="grid gap-5 text-sm">
            <section className="grid gap-2">
              <h3 className="font-semibold">{t('checkpoints')}</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {view.checkpoints.map((checkpoint) => (
                  <li key={checkpoint.day} className="rounded-lg border border-line p-3">
                    <p className="flex items-center justify-between gap-2 font-medium">
                      {checkpoint.title}
                      {checkpoint.day === view.currentDay ? (
                        <Badge tone="brand">{t('current')}</Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 text-muted">{checkpoint.description}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => setConfirmDay(checkpoint.day)}
                    >
                      <RotateCcw aria-hidden className="size-4" /> {t('jump')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="grid gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Clock aria-hidden className="size-4" /> {t('timeOfDay')}
              </h3>
              <p className="text-muted">
                {view.timeOfDay ? t('timeSet', { time: view.timeOfDay }) : t('realTime')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  aria-label={t('timeOfDay')}
                  className="min-h-10 rounded-lg border border-line px-2"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
                <Button size="sm" disabled={clock.isPending} onClick={() => clock.mutate(time)}>
                  {t('setTime')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={clock.isPending}
                  onClick={() => clock.mutate(null)}
                >
                  {t('useRealTime')}
                </Button>
              </div>
              {clock.error ? <ErrorState error={clock.error} /> : null}
            </section>
            <section className="grid gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Sparkles aria-hidden className="size-4" /> {t('ai')}
              </h3>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('ai')}>
                {(['DEMO', 'ANTHROPIC'] as const).map((provider) => (
                  <Button
                    key={provider}
                    size="sm"
                    role="radio"
                    aria-checked={view.ai.provider === provider}
                    variant={view.ai.provider === provider ? 'primary' : 'secondary'}
                    disabled={
                      ai.isPending || (provider === 'ANTHROPIC' && !view.ai.claudeAvailable)
                    }
                    onClick={() => ai.mutate(provider)}
                  >
                    {t(provider === 'DEMO' ? 'aiDemo' : 'aiClaude')}
                  </Button>
                ))}
              </div>
              {!view.ai.claudeAvailable ? (
                <p className="text-xs text-muted">{t('claudeUnavailable')}</p>
              ) : null}
              {ai.error ? <ErrorState error={ai.error} /> : null}
            </section>
          </div>
        )}
      </QueryView>
      <Dialog
        open={confirmDay !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDay(null);
        }}
        title={t('resetTitle', { day: confirmDay ?? 0 })}
        description={t('resetBody')}
      >
        {reset.isSuccess ? (
          <Alert tone="ok">{t('resetDone')}</Alert>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={reset.isPending}
              onClick={() => {
                if (confirmDay === null) return;
                reset.mutate(confirmDay, {
                  onSuccess: () => {
                    // Everyone was signed out: drop cached data and go to sign-in.
                    client.clear();
                    router.push('/login');
                  },
                });
              }}
            >
              {t('resetConfirm')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDay(null)}>
              {t('cancel')}
            </Button>
          </div>
        )}
        {reset.error ? <ErrorState error={reset.error} /> : null}
      </Dialog>
    </Card>
  );
}
