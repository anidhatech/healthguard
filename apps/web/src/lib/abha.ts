import { ApiError } from './api';

export const ABHA_JOURNEYS = '/abha/enrolments';
export const ABHA_LOGINS = '/abha/logins';
export const ABHA_FIELD = 'min-h-11 rounded-lg border border-line px-3 text-sm';

/** What ABDM or the API said, shown as it came. */
export function problemText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem.errors?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export interface AbhaHandoff {
  name: string;
  mobile: string;
  aadhaar: string;
}

/**
 * Carries what one ABHA screen already holds to the next, so a person who was
 * found to have no ABHA is never asked for their Aadhaar number again. It
 * lives in this page's memory only: never in the address bar or in storage.
 */
let pending: AbhaHandoff | null = null;

export function setAbhaHandoff(value: AbhaHandoff): void {
  pending = value;
}

/** Reads the handoff once and forgets it. */
export function takeAbhaHandoff(): AbhaHandoff | null {
  const value = pending;
  pending = null;
  return value;
}
