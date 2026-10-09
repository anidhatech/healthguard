import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import { MEMBER_ROLES } from '../roles.js';
import { OrganizationRefSchema } from './auth.js';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

export const OrganizationViewSchema = OrganizationRefSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  timezone: z.string(),
  enabledLocales: z.array(z.enum(SUPPORTED_LOCALES)),
});
export type OrganizationView = z.infer<typeof OrganizationViewSchema>;

export const MemberViewSchema = z.object({
  id: UuidSchema,
  user: z.object({ id: UuidSchema, displayName: z.string(), email: z.string().nullable() }),
  roles: z.array(z.enum(MEMBER_ROLES)),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']),
  joinedAt: IsoDateTimeSchema.nullable(),
  clinician: z
    .object({
      id: UuidSchema,
      specialty: z.string().nullable(),
      isPrescriber: z.boolean(),
    })
    .nullable(),
});
export type MemberView = z.infer<typeof MemberViewSchema>;

/** Counts only: the admin dashboard never shows clinical data. */
export const OrganizationStatsSchema = z.object({
  kind: z.literal('CALCULATED'),
  patients: z.number().int(),
  members: z.number().int(),
  clinicians: z.number().int(),
  activeConsents: z.number().int(),
  upcomingAppointments: z.number().int(),
  auditEventsLast7Days: z.number().int(),
  accessDenialsLast7Days: z.number().int(),
  aiInteractionsLast7Days: z.number().int(),
});
export type OrganizationStats = z.infer<typeof OrganizationStatsSchema>;

export const PlatformOrganizationViewSchema = OrganizationRefSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  memberCount: z.number().int(),
  patientCount: z.number().int(),
  createdAt: IsoDateTimeSchema,
});
export type PlatformOrganizationView = z.infer<typeof PlatformOrganizationViewSchema>;

export const ClinicianViewSchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  specialty: z.string().nullable(),
  qualifications: z.string().nullable(),
  isPrescriber: z.boolean(),
});
export type ClinicianView = z.infer<typeof ClinicianViewSchema>;

export const NotificationViewSchema = z.object({
  id: UuidSchema,
  channel: z.enum(['IN_APP', 'SIMULATED_PHONE', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'VOICE']),
  templateKey: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED']),
  scheduledFor: IsoDateTimeSchema,
  readAt: IsoDateTimeSchema.nullable(),
});
export type NotificationView = z.infer<typeof NotificationViewSchema>;
