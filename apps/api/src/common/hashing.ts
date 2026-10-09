import { createHash, createHmac, randomBytes } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash for identifiers (IP, user agent) so logs never hold the raw value. */
export function keyedHash(key: string, value: string | undefined | null): string | null {
  if (!value) return null;
  return createHmac('sha256', key).update(value).digest('hex').slice(0, 32);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
