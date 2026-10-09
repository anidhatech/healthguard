import type { Provenance } from '@healthguard/shared';

/** Prisma Decimal (or null) → number (or null). */
export function num(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value.toString());
}

export function iso(value: Date): string {
  return value.toISOString();
}

export function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateOnlyOrNull(value: Date | null | undefined): string | null {
  return value ? dateOnly(value) : null;
}

export function provenance(row: {
  recordSource: Provenance['recordSource'];
  sourceSystem?: string | null;
  verification?: Provenance['verification'];
}): Provenance {
  return {
    recordSource: row.recordSource,
    sourceSystem: row.sourceSystem ?? null,
    verification: row.verification ?? null,
  };
}

/** `+91 ••••• ••101`: never return a full phone number to the browser. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return `${phone.slice(0, 3)} ••••• ••${phone.slice(-3)}`;
}

export function patientDisplayName(patient: {
  givenName: string;
  familyName: string | null;
}): string {
  return [patient.givenName, patient.familyName].filter(Boolean).join(' ');
}

export function strength(medication: {
  strengthValue: { toString(): string };
  strengthUnit: string;
}): string {
  return `${num(medication.strengthValue)} ${medication.strengthUnit}`;
}
