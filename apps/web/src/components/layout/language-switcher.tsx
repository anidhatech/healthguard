'use client';

import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '@healthguard/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { api } from '@/lib/api';
import { setLocaleCookie, useSession } from '@/lib/session';

/** Changes the UI language (cookie) and, when signed in, the saved preference. */
export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const client = useQueryClient();
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();

  const change = (next: SupportedLocale) => {
    setLocaleCookie(next);
    startTransition(async () => {
      if (session)
        await api('/auth/me/locale', { method: 'PATCH', json: { preferredLocale: next } }).catch(
          () => undefined,
        );
      await client.invalidateQueries();
      router.refresh();
    });
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <Languages aria-hidden className="size-4 text-muted" />
      <span className="sr-only">{t('language')}</span>
      <select
        className="min-h-9 rounded-md border border-line bg-white px-2 text-sm"
        value={locale}
        disabled={pending}
        onChange={(event) => change(event.target.value as SupportedLocale)}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code].native}
          </option>
        ))}
      </select>
    </label>
  );
}
