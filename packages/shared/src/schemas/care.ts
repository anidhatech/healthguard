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
