import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  PersonRefSchema,
  ProvenanceSchema,
  SourceRefSchema,
  UuidSchema,
} from './common.js';

export const MedicationInstructionViewSchema = z.object({
  id: UuidSchema,
  locale: z.enum(SUPPORTED_LOCALES),
  doseText: z.string(),
  notesText: z.string().nullable(),
  method: z.enum(['TEMPLATE_ONLY', 'TEMPLATE_PLUS_AI', 'HUMAN_TRANSLATED']),
  templateKey: z.string(),
  status: z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED']),
  approvedAt: IsoDateTimeSchema.nullable(),
});
export type MedicationInstructionView = z.infer<typeof MedicationInstructionViewSchema>;

export const MedicationPlansQuerySchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  status: z.enum(['active', 'all']).optional(),
});
export type MedicationPlansQuery = z.infer<typeof MedicationPlansQuerySchema>;

export const MedicationPlanViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  provenance: ProvenanceSchema,
  medication: z.object({
    id: UuidSchema,
    genericName: z.string(),
    strength: z.string(),
    form: z.string(),
  }),
  doseQuantity: z.number(),
  doseUnit: z.string(),
  route: z.string(),
  frequency: z.number().int(),
  period: z.number().int(),
  periodUnit: z.enum(['DAY', 'WEEK', 'MONTH']),
  timingEvents: z.array(z.string()),
  timingOffsetMinutes: z.number().int().nullable(),
  timesOfDay: z.array(z.string()),
  asNeeded: z.boolean(),
  durationDays: z.number().int().nullable(),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable(),
  indication: z.string().nullable(),
  specialInstructions: z.string().nullable(),
  status: z.enum([
    'DRAFT',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'STOPPED',
    'SUPERSEDED',
    'ENTERED_IN_ERROR',
  ]),
  version: z.number().int(),
  signedAt: IsoDateTimeSchema.nullable(),
  prescriber: PersonRefSchema.nullable(),
  instruction: MedicationInstructionViewSchema.nullable(),
  /** Set for every synthetic plan so it is never mistaken for a real prescription. */
  syntheticNotice: z.string().nullable(),
});
export type MedicationPlanView = z.infer<typeof MedicationPlanViewSchema>;

export const MedicationCatalogueQuerySchema = z.strictObject({
  query: z.string().trim().max(60).optional(),
});
export type MedicationCatalogueQuery = z.infer<typeof MedicationCatalogueQuerySchema>;

export const MedicationCatalogueItemSchema = z.object({
  id: UuidSchema,
  genericName: z.string(),
  strength: z.string(),
  form: z.string(),
  defaultRoute: z.string(),
});
export type MedicationCatalogueItem = z.infer<typeof MedicationCatalogueItemSchema>;

export const AdherenceQuerySchema = z.strictObject({
  since: IsoDateSchema.optional(),
});
export type AdherenceQuery = z.infer<typeof AdherenceQuerySchema>;

/** Recorded adherence: a deterministic calculation, never a model output. */
export const AdherenceSummarySchema = z.object({
  kind: z.literal('CALCULATED'),
  label: z.string(),
  from: IsoDateSchema,
  to: IsoDateSchema,
  taken: z.number().int(),
  skipped: z.number().int(),
  missed: z.number().int(),
  due: z.number().int(),
  pending: z.number().int(),
  percentage: z.number().nullable(),
  longestMissedRun: z.number().int(),
  perPlan: z.array(
    z.object({
      planId: UuidSchema,
      medication: z.string(),
      taken: z.number().int(),
      due: z.number().int(),
      percentage: z.number().nullable(),
    }),
  ),
  formula: z.string(),
  sources: z.array(SourceRefSchema),
});
export type AdherenceSummary = z.infer<typeof AdherenceSummarySchema>;

export const DoseEventsQuerySchema = z.strictObject({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});
export type DoseEventsQuery = z.infer<typeof DoseEventsQuerySchema>;

export const DoseEventViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  planId: UuidSchema,
  medication: z.string(),
  scheduledAt: IsoDateTimeSchema,
  localDate: IsoDateSchema,
  slotLabel: z.string(),
  status: z.enum(['SCHEDULED', 'REMINDED', 'SNOOZED', 'TAKEN', 'SKIPPED', 'MISSED', 'CANCELLED']),
  respondedAt: IsoDateTimeSchema.nullable(),
  missedInferred: z.boolean(),
});
export type DoseEventView = z.infer<typeof DoseEventViewSchema>;

/** A dose due today, with the approved instruction in the reader's language. */
export const TodayDoseViewSchema = DoseEventViewSchema.extend({
  instruction: z.string().nullable(),
  reminderCount: z.number().int(),
  remindAt: IsoDateTimeSchema,
  /** True when the signed-in user is this patient and the dose can still be answered. */
  canRespond: z.boolean(),
});
export type TodayDoseView = z.infer<typeof TodayDoseViewSchema>;

export const TodayDosesQuerySchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});
export type TodayDosesQuery = z.infer<typeof TodayDosesQuerySchema>;

export const DoseParamsSchema = z.strictObject({
  patientId: UuidSchema,
  doseId: UuidSchema,
});
export type DoseParams = z.infer<typeof DoseParamsSchema>;

export const SNOOZE_MINUTES = [10, 30, 60] as const;

/** The patient's answer to a reminder. Only the patient can record it. */
export const DoseResponseRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('TAKEN'), idempotencyKey: z.string().min(8).max(64) }),
  z.strictObject({
    action: z.literal('SKIPPED'),
    idempotencyKey: z.string().min(8).max(64),
    reason: z.enum(['FELT_UNWELL', 'RAN_OUT', 'FORGOT_TO_CARRY', 'OTHER']),
  }),
  z.strictObject({
    action: z.literal('SNOOZED'),
    idempotencyKey: z.string().min(8).max(64),
    minutes: z.union([z.literal(10), z.literal(30), z.literal(60)]),
  }),
]);
export type DoseResponseRequest = z.infer<typeof DoseResponseRequestSchema>;

// ---------------------------------------------------------------------------
// Prescribing (doctor). Drafts are checked, then signed by the prescriber.
// ---------------------------------------------------------------------------

export const PRESCRIBABLE_TIMINGS = ['MORN', 'ACM', 'PCM', 'ACV', 'PCV', 'HS'] as const;
export const NOTE_PHRASE_CODES = [
  'SWALLOW_WHOLE',
  'WITH_FOOD',
  'EMPTY_STOMACH',
  'DO_NOT_STOP',
  'REPORT_SIDE_EFFECTS',
] as const;

export const DraftPlanRequestSchema = z.strictObject({
  medicationId: UuidSchema,
  doseQuantity: z.number().positive().max(4).multipleOf(0.5),
  timingEvent: z.enum(PRESCRIBABLE_TIMINGS),
  timingOffsetMinutes: z.number().int().min(0).max(60).nullable(),
  durationDays: z.number().int().min(1).max(365).nullable(),
  indication: z.string().trim().min(2).max(80),
  notePhrases: z.array(z.enum(NOTE_PHRASE_CODES)).max(5).default([]),
  /** The active plan this one replaces (a dose change is a new version). */
  replacesPlanId: UuidSchema.optional(),
  encounterId: UuidSchema.optional(),
});
export type DraftPlanRequest = z.infer<typeof DraftPlanRequestSchema>;

export const PlanParamsSchema = z.strictObject({
  patientId: UuidSchema,
  planId: UuidSchema,
});
export type PlanParams = z.infer<typeof PlanParamsSchema>;

export const PlanCheckSchema = z.object({
  code: z.enum(['ALLERGY_CONFLICT', 'DUPLICATE_ACTIVE', 'INSTRUCTION_TEMPLATE', 'PRESERVATION']),
  severity: z.enum(['BLOCK', 'WARN', 'PASS']),
  message: z.string(),
});
export type PlanCheck = z.infer<typeof PlanCheckSchema>;

export const PlanReviewSchema = z.object({
  plan: MedicationPlanViewSchema,
  checks: z.array(PlanCheckSchema),
  instructions: z.array(MedicationInstructionViewSchema),
  canSign: z.boolean(),
  /** Always shown: the app checks a short list of rules; it is not a full drug-interaction check. */
  limitations: z.string(),
});
export type PlanReview = z.infer<typeof PlanReviewSchema>;

export const SignPlanRequestSchema = z.strictObject({
  /** The prescriber has read the instruction in every language. */
  instructionsReviewed: z.literal(true),
});
export type SignPlanRequest = z.infer<typeof SignPlanRequestSchema>;

export const StopPlanRequestSchema = z.strictObject({
  reason: z.enum([
    'COURSE_NOT_NEEDED',
    'SIDE_EFFECT_REPORTED',
    'CHANGED_TREATMENT',
    'ENTERED_IN_ERROR',
  ]),
});
export type StopPlanRequest = z.infer<typeof StopPlanRequestSchema>;
