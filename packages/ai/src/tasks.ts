import {
  AI_TASK_NAMES,
  PROHIBITED_AI_TASKS,
  type AiTaskName,
  type ProhibitedAiTask,
} from '@healthguard/shared';
import type { AiTaskDefinition } from './types.js';

/**
 * The task catalogue. Only DOCTOR_BRIEF_SYNTHESIS runs in this phase; the
 * others are listed so the API can answer "planned, not available yet"
 * instead of pretending to work.
 */
export const AI_TASK_DEFINITIONS: Record<AiTaskName, AiTaskDefinition> = {
  DOCTOR_BRIEF_SYNTHESIS: {
    task: 'DOCTOR_BRIEF_SYNTHESIS',
    implemented: true,
    agent: 'doctor-brief',
    description:
      'Summarises recorded facts since the last visit for the clinician, with every claim cited.',
    categories: [
      'ENCOUNTERS',
      'CONDITIONS',
      'ALLERGIES',
      'MEDICATIONS',
      'ADHERENCE',
      'LABS',
      'VITALS',
      'ACTIVITY',
    ],
    promptKey: 'DOCTOR_BRIEF_SYNTHESIS',
  },
  TIMELINE_SUMMARY: {
    task: 'TIMELINE_SUMMARY',
    implemented: false,
    agent: 'timeline',
    description: 'Plain-language timeline summary for the patient.',
    categories: ['ENCOUNTERS', 'CONDITIONS', 'MEDICATIONS', 'LABS'],
    promptKey: 'TIMELINE_SUMMARY',
  },
  TREND_EXPLANATION: {
    task: 'TREND_EXPLANATION',
    implemented: false,
    agent: 'trends',
    description: 'Explains what a chart shows, without interpreting it clinically.',
    categories: ['LABS', 'VITALS', 'ACTIVITY'],
    promptKey: 'TREND_EXPLANATION',
  },
  MEDICATION_INSTRUCTION_NOTES: {
    task: 'MEDICATION_INSTRUCTION_NOTES',
    implemented: false,
    agent: 'instructions',
    description: 'Translates free-text notes; the dose sentence always comes from templates.',
    categories: ['MEDICATIONS'],
    promptKey: 'MEDICATION_INSTRUCTION_NOTES',
  },
  DOCUMENT_EXTRACTION: {
    task: 'DOCUMENT_EXTRACTION',
    implemented: false,
    agent: 'documents',
    description: 'Proposes structured values from an uploaded report for human review.',
    categories: ['LABS'],
    promptKey: 'DOCUMENT_EXTRACTION',
  },
  FOLLOW_UP_DISCUSSION: {
    task: 'FOLLOW_UP_DISCUSSION',
    implemented: false,
    agent: 'follow-up',
    description: 'Suggests follow-up discussion points for the clinician to consider.',
    categories: ['LABS', 'ADHERENCE'],
    promptKey: 'FOLLOW_UP_DISCUSSION',
  },
};

export const PROHIBITED_TASK_REASONS: Record<ProhibitedAiTask, string> = {
  DIAGNOSE: 'HealthGuard AI does not diagnose. Diagnosis is made by a clinician.',
  PRESCRIBE: 'HealthGuard AI does not prescribe. Prescriptions are written by a clinician.',
  CHANGE_DOSAGE: 'HealthGuard AI does not change or suggest changing a dose.',
  CHANGE_FREQUENCY:
    'HealthGuard AI does not change or suggest changing how often a medicine is taken.',
  CHANGE_ROUTE: 'HealthGuard AI does not change how a medicine is taken.',
  STOP_MEDICATION: 'HealthGuard AI never tells anyone to stop a medicine. Talk to your clinician.',
  APPROVE_TREATMENT: 'HealthGuard AI does not approve treatment. Clinicians sign every plan.',
  BOOK_APPOINTMENT:
    'HealthGuard AI does not book appointments. A person proposes and confirms them.',
  AUTONOMOUS_DECISION: 'HealthGuard AI does not make clinical decisions.',
};

export type TaskLookup =
  | { status: 'IMPLEMENTED'; definition: AiTaskDefinition }
  | { status: 'PLANNED'; definition: AiTaskDefinition }
  | { status: 'PROHIBITED'; task: ProhibitedAiTask; reason: string }
  | { status: 'UNKNOWN' };

export function lookupTask(raw: string): TaskLookup {
  const name = raw.trim().toUpperCase();
  if ((PROHIBITED_AI_TASKS as readonly string[]).includes(name)) {
    const task = name as ProhibitedAiTask;
    return { status: 'PROHIBITED', task, reason: PROHIBITED_TASK_REASONS[task] };
  }
  if ((AI_TASK_NAMES as readonly string[]).includes(name)) {
    const definition = AI_TASK_DEFINITIONS[name as AiTaskName];
    return definition.implemented
      ? { status: 'IMPLEMENTED', definition }
      : { status: 'PLANNED', definition };
  }
  return { status: 'UNKNOWN' };
}
