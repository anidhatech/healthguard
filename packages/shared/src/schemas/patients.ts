import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import { OrganizationRefSchema } from './auth.js';
import { IsoDateSchema, PersonRefSchema, UuidSchema } from './common.js';

export const SexSchema = z.enum(['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']);

export const PatientListQuerySchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  scope: z.enum(['all', 'my-care']).optional(),
});
export type PatientListQuery = z.infer<typeof PatientListQuerySchema>;

/** One row of the clinician's patient list. Demographics only. */
export const PatientListItemSchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  mrn: z.string(),
  ageYears: z.number().int(),
  sex: SexSchema,
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  primaryClinician: PersonRefSchema.nullable(),
  careRelationship: z.boolean(),
  isSynthetic: z.boolean(),
});
export type PatientListItem = z.infer<typeof PatientListItemSchema>;

export const PatientProfileViewSchema = z.object({
  id: UuidSchema,
  organization: OrganizationRefSchema,
  displayName: z.string(),
  givenName: z.string(),
  familyName: z.string().nullable(),
  mrn: z.string(),
  dateOfBirth: IsoDateSchema,
  ageYears: z.number().int(),
  sex: SexSchema,
  phoneMasked: z.string().nullable(),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  timezone: z.string(),
  dailyRoutine: z.record(z.string(), z.string()),
  primaryClinician: PersonRefSchema.nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  isSynthetic: z.boolean(),
  abhaLinked: z.boolean(),
});
export type PatientProfileView = z.infer<typeof PatientProfileViewSchema>;
