import { createHash } from 'node:crypto';

/**
 * The demo scenario timeline. Day 0 is Ananya's last visit (HbA1c 7.4%,
 * Metformin started the next day). The demo clock stands on day 92, the
 * day of her follow-up visit. Everything is fixed, so every seed run
 * produces the same rows, IDs and numbers.
 */
export const ANCHOR_DAY0 = process.env.DEMO_ANCHOR_DATE ?? '2026-07-08';
export const TODAY_OFFSET_DAYS = 92;
export const DEMO_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

const DAY0_UTC = Date.parse(`${ANCHOR_DAY0}T00:00:00.000Z`);
if (Number.isNaN(DAY0_UTC)) throw new Error(`DEMO_ANCHOR_DATE is not a date: ${ANCHOR_DAY0}`);

/** The calendar date of scenario day N, as a UTC-midnight Date (for `date` columns). */
export function dayDate(day: number): Date {
  return new Date(DAY0_UTC + day * 86_400_000);
}

/** `YYYY-MM-DD` of scenario day N. */
export function calendarDate(day: number): string {
  return dayDate(day).toISOString().slice(0, 10);
}

/** The instant of local (IST) clock time `HH:MM` on scenario day N. */
export function at(day: number, clock: string): Date {
  const [hours, minutes] = clock.split(':').map(Number);
  return new Date(
    DAY0_UTC +
      day * 86_400_000 +
      ((hours ?? 0) * 60 + (minutes ?? 0) - IST_OFFSET_MINUTES) * 60_000,
  );
}

/** An absolute calendar date (not relative to day 0), UTC midnight. */
export function calendarAt(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * Deterministic UUIDv7 for a seed label: the timestamp bits are day 0 and
 * the rest comes from a hash of the label, so IDs are stable across runs.
 */
export function seedId(label: string): string {
  const hash = createHash('sha256').update(`healthguard-demo:${label}`).digest();
  const bytes = Buffer.alloc(16);
  const ms = BigInt(DAY0_UTC);
  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((ms >> BigInt(8 * (5 - index))) & 0xffn);
  }
  hash.copy(bytes, 6, 0, 10);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Small deterministic PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** `count` integers around `mean` whose average is exactly `mean`. */
export function windowWithMean(
  random: () => number,
  count: number,
  mean: number,
  spread: number,
): number[] {
  const values = Array.from({ length: count }, () =>
    Math.round(mean + (random() * 2 - 1) * spread),
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  const last = values.length - 1;
  values[last] = (values[last] ?? mean) + (mean * count - total);
  return values;
}
