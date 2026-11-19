import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

/** The fixed texts ABDM's test cases quote. They are shown exactly as written. */
export const ABHA_TEXT = {
  aadhaarInvalid: 'Aadhaar Number is not valid',
  resendLimit: 'Maximum OTP resend attempts reached. Please try again after 30 mins',
  addressExists: 'ABHA address already exists.',
} as const;

/** One rule for every OTP screen in M1. */
export const ABHA_OTP_RULES = { resendWaitSeconds: 60, maxResends: 2, otpLength: 6 } as const;

const AadhaarNumberSchema = z.string().regex(/^[0-9]{12}$/, ABHA_TEXT.aadhaarInvalid);
const OtpSchema = z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit OTP');
const MobileSchema = z.string().regex(/^[0-9]{10}$/, 'Enter a 10-digit mobile number');

/**
 * The facility's consent screen: five declarations, each with its own
 * checkbox, then two confirmations. In an Aadhaar flow the "document other
 * than Aadhaar" declaration stays unchecked.
 */
export const AbhaConsentSchema = z.strictObject({
  termsAgreed: z.literal(true),
  aadhaarSharing: z.literal(true),
  otherDocument: z.literal(false),
  recordsLinking: z.literal(true),
  recordsSharing: z.literal(true),
  anonymizedUse: z.literal(true),
  workerConfirmed: z.literal(true),
  beneficiaryConfirmed: z.literal(true),
});
export type AbhaConsent = z.infer<typeof AbhaConsentSchema>;

export const StartAbhaEnrolmentSchema = z.strictObject({
  aadhaarNumber: AadhaarNumberSchema,
  /** The name on the screen, shown in the beneficiary's confirmation. Never typed twice. */
  beneficiaryName: z.string().trim().min(1).max(200),
  consent: AbhaConsentSchema,
});
export type StartAbhaEnrolment = z.infer<typeof StartAbhaEnrolmentSchema>;

/** A resend needs the number again: the server never keeps it. */
export const ResendAadhaarOtpSchema = z.strictObject({ aadhaarNumber: AadhaarNumberSchema });
export type ResendAadhaarOtp = z.infer<typeof ResendAadhaarOtpSchema>;

export const VerifyAadhaarOtpSchema = z.strictObject({
  otp: OtpSchema,
  /** The communication mobile, prefilled from what the desk already holds. */
  mobile: MobileSchema,
});
export type VerifyAadhaarOtp = z.infer<typeof VerifyAadhaarOtpSchema>;

export const VerifyMobileOtpSchema = z.strictObject({ otp: OtpSchema });
export type VerifyMobileOtp = z.infer<typeof VerifyMobileOtpSchema>;

/** Checked loosely here: ABDM applies its own rules and its answer is shown as it comes. */
export const CreateAbhaAddressSchema = z.strictObject({
  abhaAddress: z.string().trim().min(1).max(64),
});
export type CreateAbhaAddress = z.infer<typeof CreateAbhaAddressSchema>;

export const AbhaJourneyParamsSchema = z.strictObject({ journeyId: UuidSchema });
export type AbhaJourneyParams = z.infer<typeof AbhaJourneyParamsSchema>;

export const AbhaMatchQuerySchema = z.strictObject({
  /** The facility's own record number, when the patient gives one. */
  mrn: z.string().trim().max(50).optional(),
});
export type AbhaMatchQuery = z.infer<typeof AbhaMatchQuerySchema>;

export const SaveAbhaEnrolmentSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('LINK'), patientId: UuidSchema }),
  z.strictObject({
    action: z.literal('CREATE'),
    preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
  }),
]);
export type SaveAbhaEnrolment = z.infer<typeof SaveAbhaEnrolmentSchema>;

/** Where an OTP went and when it may be sent again. */
export const AbhaOtpChallengeSchema = z.object({
  journeyId: UuidSchema,
  /** ABDM's own words, with the masked mobile. Shown as they came. */
  message: z.string().nullable(),
  resendsLeft: z.number().int(),
  resendAvailableAt: IsoDateTimeSchema,
});
export type AbhaOtpChallenge = z.infer<typeof AbhaOtpChallengeSchema>;

export const AbhaProfileViewSchema = z.object({
  abhaNumber: z.string().nullable(),
  abhaAddresses: z.array(z.string()),
  preferredAbhaAddress: z.string().nullable(),
  name: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  mobile: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  districtName: z.string().nullable(),
  stateName: z.string().nullable(),
  pinCode: z.string().nullable(),
  /** Base64 image, when ABDM sent one. */
  photo: z.string().nullable(),
  abhaStatus: z.string().nullable(),
  kycVerified: z.boolean().nullable(),
});
export type AbhaProfileView = z.infer<typeof AbhaProfileViewSchema>;

export const AbhaEnrolmentViewSchema = z.object({
  journeyId: UuidSchema,
  /** `false`: the Aadhaar already held this ABHA. The journey carries on the same way. */
  isNew: z.boolean(),
  message: z.string().nullable(),
  profile: AbhaProfileViewSchema,
  /** `true` when the communication mobile is not the one on the ABHA and needs its own OTP. */
  mobileVerificationRequired: z.boolean(),
});
export type AbhaEnrolmentView = z.infer<typeof AbhaEnrolmentViewSchema>;

export const AbhaMobileVerificationSchema = z.object({
  verified: z.boolean(),
  message: z.string().nullable(),
});
export type AbhaMobileVerification = z.infer<typeof AbhaMobileVerificationSchema>;

export const AbhaAddressSuggestionsSchema = z.object({
  suggestions: z.array(z.string()),
  /** `@sbx` in the sandbox, `@abdm` in production. */
  suffix: z.string(),
});
export type AbhaAddressSuggestions = z.infer<typeof AbhaAddressSuggestionsSchema>;

export const AbhaAddressResultSchema = z.object({
  preferredAbhaAddress: z.string().nullable(),
});
export type AbhaAddressResult = z.infer<typeof AbhaAddressResultSchema>;

export const ABHA_MATCH_REASONS = ['ABHA_NUMBER', 'DEMOGRAPHICS', 'RECORD_NUMBER'] as const;

/** A patient already in the facility's records who may be this person. */
export const AbhaPatientMatchSchema = z.object({
  patientId: UuidSchema,
  mrn: z.string(),
  displayName: z.string(),
  reason: z.enum(ABHA_MATCH_REASONS),
  abhaLinked: z.boolean(),
});
export type AbhaPatientMatch = z.infer<typeof AbhaPatientMatchSchema>;

export const AbhaMatchesSchema = z.object({
  matches: z.array(AbhaPatientMatchSchema),
  /** A new record may be created only when no match holds. */
  mayCreate: z.boolean(),
});
export type AbhaMatches = z.infer<typeof AbhaMatchesSchema>;

export interface AbhaAddressRule {
  key: 'length' | 'characters' | 'specials' | 'edges';
  met: boolean;
}

/**
 * ABDM's rules for an ABHA address the person chooses, checked as they type so
 * each can show green or red. `handle` is the part before the suffix.
 */
export function abhaAddressRules(handle: string, suffix: string): AbhaAddressRule[] {
  const total = handle.length + suffix.length;
  return [
    { key: 'length', met: total >= 8 && total <= 18 },
    { key: 'characters', met: /^[A-Za-z0-9._]+$/.test(handle) },
    {
      key: 'specials',
      met: (handle.match(/\./g) ?? []).length <= 1 && (handle.match(/_/g) ?? []).length <= 1,
    },
    { key: 'edges', met: handle.length > 0 && !/^[._]|[._]$/.test(handle) },
  ];
}

/** Shows only the last four digits: `XXXX XXXX 1234`. */
export function maskAadhaar(value: string): string {
  const digits = value.replace(/\D+/g, '');
  return digits.length === 12 ? `XXXX XXXX ${digits.slice(8)}` : 'X'.repeat(digits.length);
}
