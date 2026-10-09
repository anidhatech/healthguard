import type { ProhibitedAiTask } from '@healthguard/shared';
import { lookupTask, PROHIBITED_TASK_REASONS } from '../tasks.js';
import type { AiTaskDefinition } from '../types.js';
import { REQUEST_RULES } from './lexicons.js';

export type RequestGateResult =
  | { allowed: true; definition: AiTaskDefinition }
  | {
      allowed: false;
      code: 'PROHIBITED_TASK' | 'PROHIBITED_INSTRUCTION' | 'UNKNOWN_TASK' | 'TASK_NOT_AVAILABLE';
      intent: ProhibitedAiTask | null;
      reason: string;
    };

/** Finds the first prohibited intent in free text, or null. */
export function detectProhibitedIntent(text: string): ProhibitedAiTask | null {
  for (const rule of REQUEST_RULES) {
    if (rule.pattern.test(text)) return rule.intent;
  }
  return null;
}

/**
 * The first gate every AI request passes, before any data is read. Refusals
 * carry a reason a person can read, and are audited by the caller.
 */
export function screenAiRequest(task: string, instruction?: string | null): RequestGateResult {
  const lookup = lookupTask(task);
  switch (lookup.status) {
    case 'PROHIBITED':
      return {
        allowed: false,
        code: 'PROHIBITED_TASK',
        intent: lookup.task,
        reason: lookup.reason,
      };
    case 'UNKNOWN':
      return {
        allowed: false,
        code: 'UNKNOWN_TASK',
        intent: null,
        reason: `Unknown AI task "${task}".`,
      };
    case 'PLANNED':
      return {
        allowed: false,
        code: 'TASK_NOT_AVAILABLE',
        intent: null,
        reason: `${lookup.definition.task} is planned for a later phase and is not available yet.`,
      };
    case 'IMPLEMENTED':
      break;
  }
  if (instruction) {
    const intent = detectProhibitedIntent(instruction);
    if (intent) {
      return {
        allowed: false,
        code: 'PROHIBITED_INSTRUCTION',
        intent,
        reason: PROHIBITED_TASK_REASONS[intent],
      };
    }
  }
  return { allowed: true, definition: lookup.definition };
}
