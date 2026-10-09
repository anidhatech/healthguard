/**
 * Small, dependency-free date helpers. Calendar dates are handled as
 * `YYYY-MM-DD` strings or as `Date` values at UTC midnight (how PostgreSQL
 * `date` columns arrive through Prisma).
 */
export const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` of a UTC-midnight date value. */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** UTC-midnight `Date` for a `YYYY-MM-DD` string. */
export function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`Not an ISO calendar date: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== value) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return parsed;
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`, both UTC-midnight dates. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** The calendar date of an instant in an IANA time zone, as `YYYY-MM-DD`. */
export function localIsoDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Completed years between a date of birth and a calendar date. */
export function ageInYears(dateOfBirth: Date, onDate: Date): number {
  let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    onDate.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (onDate.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      onDate.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Minutes the time zone is ahead of UTC at an instant (India: +330). */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a local calendar day (`YYYY-MM-DD`) starts in a time zone. */
export function zonedDayStart(isoDate: string, timeZone: string): Date {
  const utcMidnight = parseIsoDate(isoDate);
  const offset = timeZoneOffsetMinutes(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offset * 60_000);
}
