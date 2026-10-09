import { z } from 'zod';
import { DATA_CATEGORIES } from '../enums.js';
import { IsoDateSchema, IsoDateTimeSchema, UuidSchema } from './common.js';

export const ConsentPurposeViewSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  name: z.string(),
  description: z.string(),
  defaultCategories: z.array(z.enum(DATA_CATEGORIES)),
  defaultDurationDays: z.number().int(),
  abdmPurposeCode: z.string().nullable(),
});
export type ConsentPurposeView = z.infer<typeof ConsentPurposeViewSchema>;

export const ConsentViewSchema = z.object({
  id: UuidSchema,
  purpose: z.object({ code: z.string(), name: z.string() }),
  grantee: z.object({
    type: z.enum(['ORGANIZATION', 'CLINICIAN', 'USER']),
    displayName: z.string(),
  }),
  categories: z.array(z.enum(DATA_CATEGORIES)),
  dataFrom: IsoDateSchema.nullable(),
  dataTo: IsoDateSchema.nullable(),
  validFrom: IsoDateTimeSchema,
  validUntil: IsoDateTimeSchema,
  status: z.enum(['REQUESTED', 'GRANTED', 'DENIED', 'REVOKED', 'EXPIRED']),
  method: z.enum(['IN_APP', 'CLINIC_ASSISTED', 'PAPER', 'DEMO_SEED', 'ABDM', 'BREAK_GLASS']),
  decidedAt: IsoDateTimeSchema.nullable(),
  revokedAt: IsoDateTimeSchema.nullable(),
  noticeVersion: z.string(),
  noticeLocale: z.string(),
  isActiveNow: z.boolean(),
});
export type ConsentView = z.infer<typeof ConsentViewSchema>;

/** One line of the patient's "who saw my data" log. */
export const AccessLogEntrySchema = z.object({
  id: UuidSchema,
  occurredAt: IsoDateTimeSchema,
  actor: z.object({
    type: z.enum(['USER', 'SERVICE', 'AI_AGENT', 'SYSTEM']),
    displayName: z.string(),
    roles: z.array(z.string()),
    sameOrganization: z.boolean(),
    isPatient: z.boolean(),
  }),
  action: z.string(),
  resourceType: z.string(),
  purposeCode: z.string().nullable(),
  decision: z.enum(['ALLOW', 'DENY', 'NOT_APPLICABLE']),
  decisionReason: z.string().nullable(),
  outcome: z.enum(['SUCCESS', 'FAILURE']),
});
export type AccessLogEntry = z.infer<typeof AccessLogEntrySchema>;

export const AuditEventsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(40).optional(),
});
export type AuditEventsQuery = z.infer<typeof AuditEventsQuerySchema>;

export const AuditEventViewSchema = z.object({
  id: UuidSchema,
  occurredAt: IsoDateTimeSchema,
  actorType: z.enum(['USER', 'SERVICE', 'AI_AGENT', 'SYSTEM']),
  actorUserId: UuidSchema.nullable(),
  actorDisplayName: z.string().nullable(),
  actorRoles: z.array(z.string()),
  action: z.string(),
  resourceType: z.string(),
  resourceId: UuidSchema.nullable(),
  patientProfileId: UuidSchema.nullable(),
  purposeCode: z.string().nullable(),
  decision: z.enum(['ALLOW', 'DENY', 'NOT_APPLICABLE']),
  decisionReason: z.string().nullable(),
  outcome: z.enum(['SUCCESS', 'FAILURE']),
  requestId: z.string().nullable(),
});
export type AuditEventView = z.infer<typeof AuditEventViewSchema>;
