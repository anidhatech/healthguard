import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import { IsoDateTimeSchema, UuidSchema } from './common.js';
import { PatientContactSchema } from './patients.js';

/** The fixed texts ABDM's test cases quote. They are shown exactly as written. */
export const ABHA_TEXT = {
  aadhaarInvalid: 'Aadhaar Number is not valid',
  resendLimit: 'Maximum OTP resend attempts reached. Please try again after 30 mins',
  addressExists: 'ABHA address already exists.',
  mobileInvalid: 'Please enter a valid mobile number.',
  mobileNoAbha:
    'ABHA details not found. We did not find any ABHA number linked to this mobile number. Please use an ABHA-linked mobile number.',
  alreadyLinked: 'This ABHA profile is already linked to HMIS Beneficiary ID.',
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
    /** The mobile to keep on the record, when the desk changed the one from the ABHA. */
    phone: MobileSchema.optional(),
    /**
     * Contact details as the desk confirmed or changed them. A field left out
     * keeps what the ABHA profile holds; an empty one is saved as empty.
     */
    contact: PatientContactSchema.optional(),
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
  city: z.string().nullable(),
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
  /** What the facility's own record holds, to set beside the details from the ABHA. */
  record: z.object({
    /** `YYYY-MM-DD`. */
    dateOfBirth: z.string().nullable(),
    sex: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
  }),
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
    // The sandbox refused a six-character address on 2026-11-22: the minimum of
    // 8 counts the part before the suffix, and the maximum of 18 counts both.
    { key: 'length', met: handle.length >= 8 && total <= 18 },
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

/** The two OTP routes a login can use. An ABHA address offers only those its search lists. */
export const ABHA_LOGIN_METHODS = ['AADHAAR_OTP', 'MOBILE_OTP'] as const;
export type AbhaLoginMethod = (typeof ABHA_LOGIN_METHODS)[number];

const LoginMethodSchema = z.enum(ABHA_LOGIN_METHODS);
/** Not checked more strictly than ABDM does: ABDM's answer is shown as it comes. */
const AbhaIdentifierSchema = z.string().trim().min(3).max(64);

export const AbhaAddressSearchSchema = z.strictObject({ abhaAddress: AbhaIdentifierSchema });
export type AbhaAddressSearch = z.infer<typeof AbhaAddressSearchSchema>;

export const AbhaAddressMethodsSchema = z.object({
  /** The methods this address offers that HealthGuard has a screen for. Nothing else is shown. */
  methods: z.array(LoginMethodSchema),
  /** Everything ABDM listed, as it named them. */
  offeredByAbdm: z.array(z.string()),
});
export type AbhaAddressMethods = z.infer<typeof AbhaAddressMethodsSchema>;

/** The search by mobile: it lists the ABHAs on a mobile and sends no OTP. */
export const AbhaMobileSearchSchema = z.strictObject({
  mobile: z.string().regex(/^[0-9]{10}$/, ABHA_TEXT.mobileInvalid),
});
export type AbhaMobileSearch = z.infer<typeof AbhaMobileSearchSchema>;

export const AbhaMobileAccountSchema = z.object({
  /** ABDM's own number for this account in the list; the OTP request names the account by it. */
  index: z.number().int(),
  /** Masked by ABDM. */
  abhaNumber: z.string().nullable(),
  name: z.string().nullable(),
  gender: z.string().nullable(),
});
export type AbhaMobileAccount = z.infer<typeof AbhaMobileAccountSchema>;

export const AbhaMobileSearchResultSchema = z.object({
  /** `NO_ABHA`: the mobile holds no ABHA. No OTP step follows, and creation is offered. */
  outcome: z.enum(['FOUND', 'NO_ABHA']),
  /** Names this search when the OTP is requested for one of its accounts. */
  searchId: UuidSchema.nullable(),
  /** Every account on the mobile, never only the first. */
  accounts: z.array(AbhaMobileAccountSchema),
});
export type AbhaMobileSearchResult = z.infer<typeof AbhaMobileSearchResultSchema>;

export const StartAbhaLoginSchema = z.discriminatedUnion('identifier', [
  z.strictObject({
    identifier: z.literal('MOBILE'),
    searchId: UuidSchema,
    /** The account the person picked from the search. */
    index: z.number().int().min(0),
  }),
  z.strictObject({
    identifier: z.literal('ABHA_NUMBER'),
    value: AbhaIdentifierSchema,
    method: LoginMethodSchema,
    /** The mobile the desk holds for the patient, to compare with the one on the ABHA. */
    deskMobile: MobileSchema.optional(),
  }),
  z.strictObject({
    identifier: z.literal('ABHA_ADDRESS'),
    value: AbhaIdentifierSchema,
    method: LoginMethodSchema,
    deskMobile: MobileSchema.optional(),
  }),
  z.strictObject({
    identifier: z.literal('AADHAAR'),
    value: AadhaarNumberSchema,
    beneficiaryName: z.string().trim().min(1).max(200),
    consent: AbhaConsentSchema,
    deskMobile: MobileSchema.optional(),
  }),
]);
export type StartAbhaLogin = z.infer<typeof StartAbhaLoginSchema>;

/** A resend needs the identifier again: the server never keeps an Aadhaar number. */
export const ResendAbhaLoginSchema = z.strictObject({
  /** Not needed after a search by mobile, which keeps the chosen account. */
  value: AbhaIdentifierSchema.optional(),
});
export type ResendAbhaLogin = z.infer<typeof ResendAbhaLoginSchema>;

export const VerifyAbhaLoginSchema = z.strictObject({ otp: OtpSchema });
export type VerifyAbhaLogin = z.infer<typeof VerifyAbhaLoginSchema>;

export const UpdateAbhaMobileSchema = z.strictObject({ mobile: MobileSchema });
export type UpdateAbhaMobile = z.infer<typeof UpdateAbhaMobileSchema>;

export const AbhaLoginViewSchema = z.object({
  journeyId: UuidSchema,
  /** `NO_ABHA`: the Aadhaar holds no ABHA, and the desk is offered creation. */
  outcome: z.enum(['VERIFIED', 'NO_ABHA']),
  message: z.string().nullable(),
  profile: AbhaProfileViewSchema.nullable(),
  /** How many accounts the login returned; the first is the one shown. */
  accounts: z.number().int(),
  /**
   * `OFFER`: the desk's mobile differs from the ABHA's, so ask Yes or No.
   * `NOT_AVAILABLE`: it differs, but this kind of login cannot update it.
   */
  mobileUpdate: z.enum(['NOT_NEEDED', 'OFFER', 'NOT_AVAILABLE']),
});
export type AbhaLoginView = z.infer<typeof AbhaLoginViewSchema>;

/** Maps the method names ABDM lists for an ABHA address onto the routes there is a screen for. */
export function abhaLoginMethodsFrom(authMethods: readonly string[]): AbhaLoginMethod[] {
  const methods: AbhaLoginMethod[] = [];
  for (const name of authMethods) {
    const key = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (!key.includes('OTP')) continue;
    if (key.includes('AADHAAR') && !methods.includes('AADHAAR_OTP')) methods.push('AADHAAR_OTP');
    if (key.includes('MOBILE') && !methods.includes('MOBILE_OTP')) methods.push('MOBILE_OTP');
  }
  return methods;
}
