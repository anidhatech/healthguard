import { createHash } from 'node:crypto';
import { stableStringify } from '@healthguard/shared';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Same task, prompt version, facts and instruction → same hash (and same fixture). */
export function hashInput(parts: {
  task: string;
  promptVersion: string;
  factSheet: unknown;
  instruction: string | null;
}): string {
  return sha256Hex(stableStringify(parts));
}
