import { z } from 'zod';
import {
  AI_INTERACTION_STATUSES,
  AI_PROVIDER_NAMES,
  AI_RECOMMENDATION_TYPES,
  CONFIDENCE_LEVELS,
} from '../enums.js';
import { IsoDateTimeSchema, PurposeSchema, SourceRefSchema, UuidSchema } from './common.js';

/** AI tasks the orchestrator knows about. Only implemented ones run. */
export const AI_TASK_NAMES = [
  'DOCTOR_BRIEF_SYNTHESIS',
  'TIMELINE_SUMMARY',
  'TREND_EXPLANATION',
  'MEDICATION_INSTRUCTION_NOTES',
  'DOCUMENT_EXTRACTION',
  'FOLLOW_UP_DISCUSSION',
] as const;
export type AiTaskName = (typeof AI_TASK_NAMES)[number];

export const IMPLEMENTED_AI_TASKS = [
  'DOCTOR_BRIEF_SYNTHESIS',
] as const satisfies readonly AiTaskName[];

/**
 * Requests the AI must never act on, whatever the wording. They are named so
 * a refusal can be explained and audited instead of failing as a typo.
 */
export const PROHIBITED_AI_TASKS = [
  'DIAGNOSE',
  'PRESCRIBE',
  'CHANGE_DOSAGE',
  'CHANGE_FREQUENCY',
  'CHANGE_ROUTE',
  'STOP_MEDICATION',
  'APPROVE_TREATMENT',
  'BOOK_APPOINTMENT',
  'AUTONOMOUS_DECISION',
] as const;
export type ProhibitedAiTask = (typeof PROHIBITED_AI_TASKS)[number];

export const AiRequestBodySchema = z.strictObject({
  /** Validated by the orchestrator so prohibited tasks are refused with a reason. */
  task: z.string().trim().min(1).max(64),
  purpose: PurposeSchema.optional(),
  /** Optional clinician focus text, screened for prohibited requests. */
  instruction: z.string().trim().max(500).optional(),
});
export type AiRequestBody = z.infer<typeof AiRequestBodySchema>;

// ---------------------------------------------------------------------------
// Model output schemas. These are what a provider must return; zod re-checks
// every constraint after parsing, whatever the provider promised.
// ---------------------------------------------------------------------------

export const FactIdSchema = z.string().regex(/^[fc]-\d{2,3}$/);

export const BriefClaimSchema = z.strictObject({
  text: z.string().min(1).max(400),
  factIds: z.array(FactIdSchema).min(1).max(8),
});
export type BriefClaim = z.infer<typeof BriefClaimSchema>;

export const BriefObservationSchema = z.strictObject({
  type: z.enum(AI_RECOMMENDATION_TYPES),
  text: z.string().min(1).max(400),
  rationale: z.string().min(1).max(300),
  confidence: z.enum(CONFIDENCE_LEVELS),
  factIds: z.array(FactIdSchema).min(1).max(8),
});
export type BriefObservation = z.infer<typeof BriefObservationSchema>;

export const DoctorBriefSynthesisSchema = z.strictObject({
  summary: z.array(BriefClaimSchema).max(6),
  observations: z.array(BriefObservationSchema).max(4),
  insufficientData: z.boolean(),
});
export type DoctorBriefSynthesis = z.infer<typeof DoctorBriefSynthesisSchema>;

// ---------------------------------------------------------------------------
// API views
// ---------------------------------------------------------------------------

export const ValidationCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  detail: z.string().optional(),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const AiResultViewSchema = z.object({
  interactionId: UuidSchema,
  task: z.string(),
  status: z.enum(AI_INTERACTION_STATUSES),
  kind: z.literal('AI_SUMMARY'),
  notice: z.string(),
  provider: z.enum(AI_PROVIDER_NAMES),
  model: z.string(),
  promptKey: z.string(),
  promptVersion: z.string(),
  cached: z.boolean(),
  latencyMs: z.number().int(),
  confidence: z.enum(CONFIDENCE_LEVELS).nullable(),
  generatedAt: IsoDateTimeSchema,
  fallbackReason: z.string().nullable(),
  summary: z.array(
    z.object({
      claimKey: z.string(),
      text: z.string(),
      sources: z.array(SourceRefSchema),
    }),
  ),
  observations: z.array(
    z.object({
      id: UuidSchema,
      kind: z.literal('AI_RECOMMENDATION'),
      type: z.enum(AI_RECOMMENDATION_TYPES),
      text: z.string(),
      rationale: z.string().nullable(),
      confidence: z.enum(CONFIDENCE_LEVELS),
      status: z.enum(['PROPOSED', 'ACCEPTED', 'DISMISSED', 'EXPIRED']),
      sources: z.array(SourceRefSchema),
    }),
  ),
  validation: z.object({
    passed: z.boolean(),
    checks: z.array(ValidationCheckSchema),
  }),
});
export type AiResultView = z.infer<typeof AiResultViewSchema>;

export const AiInteractionDetailsSchema = z.object({
  id: UuidSchema,
  task: z.string(),
  agent: z.string(),
  status: z.enum(AI_INTERACTION_STATUSES),
  provider: z.enum(AI_PROVIDER_NAMES),
  model: z.string(),
  promptKey: z.string(),
  promptVersion: z.string(),
  promptHash: z.string(),
  inputFactCount: z.number().int(),
  cached: z.boolean(),
  latencyMs: z.number().int().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS).nullable(),
  fallbackReason: z.string().nullable(),
  validation: z.unknown(),
  createdAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
});
export type AiInteractionDetails = z.infer<typeof AiInteractionDetailsSchema>;

export const AiStatusSchema = z.object({
  provider: z.enum(AI_PROVIDER_NAMES),
  fallbackProvider: z.enum(['DEMO', 'NONE']),
  anthropicKeyConfigured: z.boolean(),
  models: z.object({ default: z.string(), fast: z.string() }),
  implementedTasks: z.array(z.string()),
  plannedTasks: z.array(z.string()),
  prohibitedTasks: z.array(z.string()),
  notice: z.string(),
});
export type AiStatus = z.infer<typeof AiStatusSchema>;
