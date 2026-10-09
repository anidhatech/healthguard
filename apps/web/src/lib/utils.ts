import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const DATE_LOCALES: Record<string, string> = {
  'en-IN': 'en-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
};

/** `2026-10-08` or an ISO instant → "8 Oct 2026" in the UI language (India time). */
export function formatDate(value: string | null | undefined, locale = 'en-IN'): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatTime(value: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

/** Numbers always use Latin digits (clinical safety: one way to read a dose). */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value);
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
