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
export const PATIENT_FLAGS = [
  'MISSED_DOSES',
  'CALLBACK_OPEN',
  'LAB_TO_CONFIRM',
  'APPOINTMENT_AWAITING_PATIENT',
] as const;
export type PatientFlag = (typeof PATIENT_FLAGS)[number];

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
  /**
   * Calculated work-list flags, only for patients whose data the caller may
   * see. They prompt a look; they are not clinical judgements.
   */
  flags: z.array(z.enum(PATIENT_FLAGS)),
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
  email: z.string().nullable(),
  /** The address as one line, joined from its parts; `null` when none is recorded. */
  address: z.string().nullable(),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  timezone: z.string(),
  dailyRoutine: z.record(z.string(), z.string()),
  primaryClinician: PersonRefSchema.nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  isSynthetic: z.boolean(),
  abhaLinked: z.boolean(),
});
export type PatientProfileView = z.infer<typeof PatientProfileViewSchema>;

/**
 * Contact details kept on the patient record. Each is optional; an empty value
 * clears it. They may be typed at the desk or come from a verified ABHA profile.
 */
export const PatientContactSchema = z.strictObject({
  email: z.union([z.email().max(254), z.literal('')]).optional(),
  addressLine: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pinCode: z
    .string()
    .trim()
    .regex(/^([0-9]{6})?$/, 'Enter a 6-digit PIN code')
    .optional(),
});
export type PatientContact = z.infer<typeof PatientContactSchema>;

/** What the front desk enters to register a patient. ABHA details never come from this form. */
export const RegisterPatientSchema = z.strictObject({
  ...PatientContactSchema.shape,
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: IsoDateSchema,
  sex: SexSchema,
  /** Digits with an optional leading plus; stored as entered, shown masked. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/)
    .optional(),
  preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
});
export type RegisterPatient = z.infer<typeof RegisterPatientSchema>;

export const PatientRegistrationResultSchema = z.object({
  /**
   * `EXISTING` means a verified ABHA number was already linked to this patient,
   * so no second record was created.
   */
  status: z.enum(['CREATED', 'EXISTING']),
  patient: z.object({
    id: UuidSchema,
    mrn: z.string(),
    displayName: z.string(),
    abhaLinked: z.boolean(),
  }),
});
export type PatientRegistrationResult = z.infer<typeof PatientRegistrationResultSchema>;

/**
 * The form ABHA numbers are stored and compared in: digits only. The check is
 * no stricter than that, so a number ABDM issued is never refused here.
 */
export function normalizeAbhaNumber(value: string): string {
  return value.replace(/[\s-]+/g, '').trim();
}

/** ABHA addresses compare without regard to case or surrounding space. */
export function normalizeAbhaAddress(value: string): string {
  return value.trim().toLowerCase();
}
