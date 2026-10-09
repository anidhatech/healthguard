'use client';

import {
  DEMO_AUTH_NOTICE,
  SAFETY_STATEMENT,
  type DemoAccountsResponse,
  type SessionView,
} from '@healthguard/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { api, ApiError } from '@/lib/api';
import { setLocaleCookie } from '@/lib/session';

function LoginForm() {
  const t = useTranslations('login');
  const params = useSearchParams();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const accounts = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: () => api<DemoAccountsResponse>('/auth/demo-accounts'),
  });

  const finish = (session: SessionView) => {
    client.setQueryData(['session'], session);
    // The interface follows the language saved on the account.
    setLocaleCookie(session.user.preferredLocale);
    const next = params.get('next');
    // A full navigation re-renders the server parts with the new language.
    window.location.assign(
      next?.startsWith(`/${session.homeArea}/`) ? next : `/${session.homeArea}/dashboard`,
    );
  };

  const quick = async (email: string) => {
    setBusy(email);
    setError(null);
    try {
      finish(await api<SessionView>('/auth/demo-login', { method: 'POST', json: { email } }));
    } catch (caught) {
      setError(caught);
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('password');
    setError(null);
    try {
      finish(
        await api<SessionView>('/auth/login', {
          method: 'POST',
          json: { email: form.get('email'), password: form.get('password') },
        }),
      );
    } catch (caught) {
      setError(caught);
      setBusy(null);
    }
  };

  const primary = accounts.data?.accounts.filter((account) => account.primary) ?? [];
  const others = accounts.data?.accounts.filter((account) => !account.primary) ?? [];

  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-700">
            <ShieldCheck aria-hidden className="size-7" /> {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {error ? (
        error instanceof ApiError && error.status === 401 ? (
          <Alert tone="danger" title={t('failed')} />
        ) : (
          <ErrorState error={error} />
        )
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t('quickSignIn')}</h2>
          <Badge tone="warn">DEMO / DEVELOPMENT</Badge>
        </div>
        <Alert tone="warn" className="mb-4">
          {DEMO_AUTH_NOTICE}
        </Alert>
        {accounts.isLoading ? <LoadingState /> : null}
        {accounts.data && !accounts.data.enabled ? (
          <Alert tone="info">Demo sign-in is turned off on this server.</Alert>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-3">
          {primary.map((account) => (
            <li key={account.key}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void quick(account.email)}
                className="flex h-full w-full flex-col items-start gap-1 rounded-lg border border-line bg-white p-3 text-left hover:border-brand-600 hover:bg-brand-50 disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <UserRound aria-hidden className="size-4 text-brand-700" /> {account.persona}
                </span>
                <span className="text-sm">{account.displayName}</span>
                <span className="text-xs text-muted">{account.description}</span>
                <span className="mt-1 font-mono text-[11px] text-muted">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
        {others.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              {t('more')}
            </summary>
            <ul className="mt-2 divide-y divide-line">
              {others.map((account) => (
                <li
                  key={account.key}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {account.displayName} <span className="text-muted">· {account.persona}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {account.description} ({account.organizationName})
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void quick(account.email)}
                  >
                    {t('signInAs', { name: account.displayName.split(' ').slice(-2).join(' ') })}
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      {accounts.data?.passwordLoginEnabled ? (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <KeyRound aria-hidden className="size-4" /> {t('orPassword')}
          </h2>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => void submit(event)}
          >
            <label className="grid gap-1 text-sm">
              {t('email')}
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="min-h-11 rounded-md border border-line px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t('password')}
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="min-h-11 rounded-md border border-line px-3"
              />
            </label>
            <Button type="submit" disabled={busy !== null}>
              {t('signIn')}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted">{t('demoPasswordHint')}</p>
        </Card>
      ) : null}

      <p className="text-xs text-muted">{SAFETY_STATEMENT}</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginForm />
    </Suspense>
  );
}
