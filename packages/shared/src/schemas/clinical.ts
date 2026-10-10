import { z } from 'zod';
import { DATA_CATEGORIES } from '../enums.js';
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  PersonRefSchema,
  ProvenanceSchema,
  UuidSchema,
} from './common.js';

/** Fields every recorded clinical fact carries. */
const factFields = {
  id: UuidSchema,
  kind: z.literal('FACT'),
  provenance: ProvenanceSchema,
};

const ClinicalStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'RESOLVED']);
const ClinicalVerificationSchema = z.enum(['UNCONFIRMED', 'PROVISIONAL', 'CONFIRMED', 'REFUTED']);

export const ConditionViewSchema = z.object({
  ...factFields,
  display: z.string(),
  codeSystem: z.string().nullable(),
  code: z.string().nullable(),
  clinicalStatus: ClinicalStatusSchema,
  clinicalVerification: ClinicalVerificationSchema,
  onsetDate: IsoDateSchema.nullable(),
  abatementDate: IsoDateSchema.nullable(),
  note: z.string().nullable(),
});
export type ConditionView = z.infer<typeof ConditionViewSchema>;

export const AllergyViewSchema = z.object({
  ...factFields,
  substance: z.string(),
  type: z.enum(['ALLERGY', 'INTOLERANCE']),
  category: z.enum(['MEDICATION', 'FOOD', 'ENVIRONMENT', 'BIOLOGIC']),
  criticality: z.enum(['LOW', 'HIGH', 'UNABLE_TO_ASSESS']).nullable(),
  reaction: z.string().nullable(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).nullable(),
  clinicalStatus: ClinicalStatusSchema,
  clinicalVerification: ClinicalVerificationSchema,
  onsetDate: IsoDateSchema.nullable(),
});
export type AllergyView = z.infer<typeof AllergyViewSchema>;

export const ProcedureViewSchema = z.object({
  ...factFields,
  display: z.string(),
  code: z.string().nullable(),
  status: z.enum(['COMPLETED', 'NOT_DONE']),
  performedOn: IsoDateSchema.nullable(),
  performerText: z.string().nullable(),
  facilityText: z.string().nullable(),
  outcome: z.string().nullable(),
});
export type ProcedureView = z.infer<typeof ProcedureViewSchema>;

export const ImmunizationViewSchema = z.object({
  ...factFields,
  vaccineName: z.string(),
  vaccineCode: z.string().nullable(),
  status: z.enum(['COMPLETED', 'NOT_DONE']),
  occurredOn: IsoDateSchema,
  doseNumber: z.number().int().nullable(),
});
export type ImmunizationView = z.infer<typeof ImmunizationViewSchema>;

export const EncounterViewSchema = z.object({
  ...factFields,
  type: z.enum(['OUTPATIENT', 'TELECONSULT', 'FOLLOW_UP', 'INPATIENT']),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  reasonForVisit: z.string().nullable(),
  startedAt: IsoDateTimeSchema.nullable(),
  endedAt: IsoDateTimeSchema.nullable(),
  clinician: PersonRefSchema,
});
export type EncounterView = z.infer<typeof EncounterViewSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  kind: z.literal('FACT'),
  date: IsoDateTimeSchema,
  category: z.enum(DATA_CATEGORIES),
  eventType: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  source: z.object({ type: z.string(), id: UuidSchema }),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/** The timeline plus the categories the caller may not see (so the UI can say so). */
export const TimelineViewSchema = z.object({
  events: z.array(TimelineEventSchema),
  hiddenCategories: z.array(z.enum(DATA_CATEGORIES)),
});
export type TimelineView = z.infer<typeof TimelineViewSchema>;

export const LabResultViewSchema = z.object({
  ...factFields,
  test: z.object({
    id: UuidSchema,
    code: z.string(),
    loincCode: z.string().nullable(),
    name: z.string(),
  }),
  valueNumeric: z.number().nullable(),
  valueText: z.string().nullable(),
  unit: z.string(),
  referenceLow: z.number().nullable(),
  referenceHigh: z.number().nullable(),
  interpretation: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH']).nullable(),
  effectiveAt: IsoDateTimeSchema,
  issuedAt: IsoDateTimeSchema.nullable(),
  status: z.enum(['PRELIMINARY', 'FINAL', 'AMENDED']),
  performingLab: z.string().nullable(),
  documentId: UuidSchema.nullable(),
  /** Read from an uploaded report: shown, but not used in trends until the patient confirms it. */
  extractionConfidence: z.number().nullable(),
  awaitingConfirmation: z.boolean(),
});
export type LabResultView = z.infer<typeof LabResultViewSchema>;

export const LabResultsQuerySchema = z.strictObject({
  /** Lab test code, for example HBA1C. */
  test: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Z0-9_]+$/)
    .optional(),
});
export type LabResultsQuery = z.infer<typeof LabResultsQuerySchema>;

export const LabTestViewSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  loincCode: z.string().nullable(),
  name: z.string(),
  unit: z.string(),
  category: z.string(),
});
export type LabTestView = z.infer<typeof LabTestViewSchema>;

export const VITAL_TYPES = [
  'BLOOD_PRESSURE',
  'HEART_RATE',
  'BODY_WEIGHT',
  'BODY_HEIGHT',
  'BLOOD_GLUCOSE',
  'OXYGEN_SATURATION',
  'BODY_TEMPERATURE',
] as const;

export const VitalsQuerySchema = z.strictObject({
  type: z.enum(VITAL_TYPES).optional(),
});
export type VitalsQuery = z.infer<typeof VitalsQuerySchema>;

export const VitalViewSchema = z.object({
  ...factFields,
  type: z.enum(VITAL_TYPES),
  value: z.number(),
  value2: z.number().nullable(),
  unit: z.string(),
  measuredAt: IsoDateTimeSchema,
  context: z.string().nullable(),
});
export type VitalView = z.infer<typeof VitalViewSchema>;

export const ACTIVITY_METRIC_TYPES = [
  'STEPS',
  'SLEEP_DURATION',
  'ACTIVE_MINUTES',
  'RESTING_HEART_RATE',
  'WORKOUT_MINUTES',
] as const;

export const ActivityQuerySchema = z.strictObject({
  metric: z.enum(ACTIVITY_METRIC_TYPES).default('STEPS'),
  days: z.coerce.number().int().min(7).max(366).default(120),
});
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;

export const ActivitySeriesSchema = z.object({
  kind: z.literal('FACT'),
  metric: z.enum(ACTIVITY_METRIC_TYPES),
  unit: z.string(),
  from: IsoDateSchema,
  to: IsoDateSchema,
  points: z.array(z.object({ date: IsoDateSchema, value: z.number() })),
  sourceSystems: z.array(z.string()),
  average: z.object({
    kind: z.literal('CALCULATED'),
    windowDays: z.number().int(),
    from: IsoDateSchema,
    to: IsoDateSchema,
    value: z.number().nullable(),
    daysWithData: z.number().int(),
  }),
});
export type ActivitySeries = z.infer<typeof ActivitySeriesSchema>;

export const DocumentViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  type: z.enum([
    'LAB_REPORT',
    'IMAGING_REPORT',
    'PRESCRIPTION',
    'DISCHARGE_SUMMARY',
    'CONSULTATION_NOTE',
    'VACCINATION_RECORD',
    'OTHER',
  ]),
  title: z.string(),
  documentDate: IsoDateSchema.nullable(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  status: z.string(),
  isSyntheticSample: z.boolean(),
  createdAt: IsoDateTimeSchema,
  download: z.object({ available: z.boolean(), note: z.string() }),
});
export type DocumentView = z.infer<typeof DocumentViewSchema>;

export const PROGRESS_METRICS = [
  'HBA1C',
  'BODY_WEIGHT',
  'AVERAGE_DAILY_STEPS',
  'RECORDED_ADHERENCE',
] as const;
export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

/**
 * "Since the last visit" comparisons. Every number is a recorded value or a
 * deterministic calculation with its sources; nothing here is a model output.
 */
export const ProgressSummarySchema = z.object({
  kind: z.literal('CALCULATED'),
  lastVisitDate: IsoDateSchema.nullable(),
  asOf: IsoDateSchema,
  metrics: z.array(
    z.object({
      metric: z.enum(PROGRESS_METRICS),
      label: z.string(),
      unit: z.string(),
      before: z.number().nullable(),
      beforeDate: IsoDateSchema.nullable(),
      after: z.number().nullable(),
      afterDate: IsoDateSchema.nullable(),
      direction: z.enum(['up', 'down', 'same']).nullable(),
      method: z.string(),
      sourceIds: z.array(UuidSchema),
    }),
  ),
  hiddenMetrics: z.array(z.enum(PROGRESS_METRICS)),
  /**
   * A calculated sentence about numbers that moved together. It never claims
   * one caused the other.
   */
  association: z.string().nullable(),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;

export const DocumentParamsSchema = z.strictObject({
  patientId: UuidSchema,
  documentId: UuidSchema,
});
export type DocumentParams = z.infer<typeof DocumentParamsSchema>;

/** The patient checks each value read from their report against the paper. */
export const ConfirmExtractedValuesSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        labResultId: UuidSchema,
        decision: z.enum(['MATCHES_REPORT', 'DOES_NOT_MATCH']),
      }),
    )
    .min(1)
    .max(30),
});
export type ConfirmExtractedValues = z.infer<typeof ConfirmExtractedValuesSchema>;
