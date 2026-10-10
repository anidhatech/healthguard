import { z } from 'zod';
import { IsoDateSchema, IsoDateTimeSchema, PersonRefSchema, UuidSchema } from './common.js';

export const AppointmentViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  status: z.enum([
    'PROPOSED',
    'PATIENT_APPROVED',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW',
  ]),
  mode: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']),
  startAt: IsoDateTimeSchema,
  endAt: IsoDateTimeSchema,
  reason: z.string().nullable(),
  clinician: PersonRefSchema,
  proposedAt: IsoDateTimeSchema,
  patientApprovedAt: IsoDateTimeSchema.nullable(),
  confirmedAt: IsoDateTimeSchema.nullable(),
  cancelledAt: IsoDateTimeSchema.nullable(),
});
export type AppointmentView = z.infer<typeof AppointmentViewSchema>;

export const FollowUpViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  type: z.enum(['VISIT', 'REPEAT_TEST', 'CALLBACK', 'REVIEW']),
  origin: z.enum(['CLINICIAN', 'RULE', 'PATIENT_REQUEST']),
  reason: z.string(),
  dueDate: IsoDateSchema,
  windowStart: IsoDateSchema.nullable(),
  windowEnd: IsoDateSchema.nullable(),
  status: z.enum(['PLANNED', 'DUE', 'PROPOSED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'OVERDUE']),
  labTest: z.object({ code: z.string(), name: z.string() }).nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
});
export type FollowUpView = z.infer<typeof FollowUpViewSchema>;

export const CarePlanViewSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  title: z.string(),
  goals: z.array(z.string()),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'REVOKED']),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable(),
  author: PersonRefSchema,
});
export type CarePlanView = z.infer<typeof CarePlanViewSchema>;

export const ScheduleQuerySchema = z.strictObject({
  /** Calendar date in the organization's time zone; defaults to today. */
  date: IsoDateSchema.optional(),
  /** `me` (default for clinicians) or `all` appointments in the organization. */
  clinician: z.enum(['me', 'all']).optional(),
});
export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;

/** One appointment in a staff day view, with the patient's demographics only. */
export const ScheduleItemSchema = AppointmentViewSchema.extend({
  patient: z.object({ id: UuidSchema, displayName: z.string(), mrn: z.string() }),
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

/** Emergency numbers shown before any "Need help" form (India). */
export const EMERGENCY_NUMBERS = [
  { number: '112', label: 'National emergency' },
  { number: '108', label: 'Ambulance' },
] as const;

export const HELP_REASONS = ['SIDE_EFFECT', 'MEDICINE_QUESTION', 'MISSED_DOSES', 'OTHER'] as const;

/** "Need help": asks the care team to call back. Not an emergency channel. */
export const HelpRequestSchema = z.strictObject({
  reason: z.enum(HELP_REASONS),
  doseId: UuidSchema.optional(),
  note: z.string().trim().max(280).optional(),
});
export type HelpRequest = z.infer<typeof HelpRequestSchema>;

export const HelpRequestResultSchema = z.object({
  followUpId: UuidSchema,
  /** False when an open call-back request already existed. */
  created: z.boolean(),
  status: z.string(),
  dueDate: IsoDateSchema,
  emergencyNumbers: z.array(z.object({ number: z.string(), label: z.string() })),
  message: z.string(),
});
export type HelpRequestResult = z.infer<typeof HelpRequestResultSchema>;

export const CareQueueItemSchema = z.object({
  id: UuidSchema,
  kind: z.literal('FACT'),
  patient: z.object({ id: UuidSchema, displayName: z.string(), mrn: z.string() }),
  type: z.string(),
  origin: z.enum(['CLINICIAN', 'RULE', 'PATIENT_REQUEST']),
  reason: z.string(),
  status: z.string(),
  dueDate: IsoDateSchema,
  overdue: z.boolean(),
  assignedTo: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type CareQueueItem = z.infer<typeof CareQueueItemSchema>;

export const CompleteFollowUpSchema = z.strictObject({
  outcome: z.enum(['CALLED_RESOLVED', 'CALLED_ESCALATED_TO_DOCTOR', 'NO_ANSWER_CLOSED']),
});
export type CompleteFollowUp = z.infer<typeof CompleteFollowUpSchema>;

export const AppointmentParamsSchema = z.strictObject({
  patientId: UuidSchema,
  appointmentId: UuidSchema,
});
export type AppointmentParams = z.infer<typeof AppointmentParamsSchema>;

/** Staff propose; the patient approves; staff confirm. Never confirmed without the patient. */
export const ProposeAppointmentSchema = z.strictObject({
  clinicianId: UuidSchema,
  startAt: IsoDateTimeSchema,
  durationMinutes: z.number().int().min(10).max(60).default(20),
  mode: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']).default('IN_PERSON'),
  reason: z.string().trim().min(2).max(120),
  followUpId: UuidSchema.optional(),
});
export type ProposeAppointment = z.infer<typeof ProposeAppointmentSchema>;

export const CancelAppointmentSchema = z.strictObject({
  reason: z.enum([
    'PATIENT_DECLINED',
    'PATIENT_CANNOT_ATTEND',
    'CLINICIAN_UNAVAILABLE',
    'NO_LONGER_NEEDED',
  ]),
});
export type CancelAppointment = z.infer<typeof CancelAppointmentSchema>;

export const AppointmentRequestSchema = z.strictObject({
  reason: z.enum(['FOLLOW_UP', 'NEW_PROBLEM', 'REPORT_REVIEW', 'OTHER']),
  preferredWindow: z.enum(['THIS_WEEK', 'NEXT_WEEK', 'ANY_TIME']),
});
export type AppointmentRequest = z.infer<typeof AppointmentRequestSchema>;
