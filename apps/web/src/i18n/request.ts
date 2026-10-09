import { COOKIE_NAMES, resolveLocale } from '@healthguard/shared';
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

// Locale comes from the NEXT_LOCALE cookie (no locale prefix in URLs).
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(COOKIE_NAMES.locale)?.value);
  const messages = (await import(`../../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, messages: messages.default, timeZone: 'Asia/Kolkata' };
});
