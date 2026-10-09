/**
 * Supported locales as BCP 47 tags. Adding a language means adding the tag
 * here, a UI message catalogue, reviewed instruction templates and a font:
 * no schema change.
 */
export const SUPPORTED_LOCALES = ['en-IN', 'hi-IN', 'te-IN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-IN';

export const LOCALE_LABELS: Record<SupportedLocale, { native: string; english: string }> = {
  'en-IN': { native: 'English', english: 'English' },
  'hi-IN': { native: 'हिन्दी', english: 'Hindi' },
  'te-IN': { native: 'తెలుగు', english: 'Telugu' },
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
