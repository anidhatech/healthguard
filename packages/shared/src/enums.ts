/**
 * String unions shared by the API and the web app. The API has a unit test
 * that fails if any of these drift from the Prisma enums of the same name.
 */
export const DATA_CATEGORIES = [
  'DEMOGRAPHICS',
  'ENCOUNTERS',
  'CONDITIONS',
  'ALLERGIES',
  'HISTORY',
  'MEDICATIONS',
  'ADHERENCE',
  'LABS',
  'VITALS',
  'ACTIVITY',
  'DOCUMENTS',
  'CARE_PLAN',
  'APPOINTMENTS',
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

/** Every category except demographics. */
export const CLINICAL_CATEGORIES = DATA_CATEGORIES.filter(
  (category): category is Exclude<DataCategory, 'DEMOGRAPHICS'> => category !== 'DEMOGRAPHICS',
);

export const ACCESS_ACTIONS = ['READ', 'CREATE', 'UPDATE', 'SIGN', 'EXPORT'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/** Consent purpose codes (reference data rows in ConsentPurpose). */
export const PURPOSE_CODES = [
  'CONSULTATION',
  'MEDICATION_MANAGEMENT',
  'LAB_REVIEW',
  'AI_ASSISTANCE',
  'CAREGIVING',
  'EMERGENCY_ACCESS',
] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

/** Purposes a staff member may declare for a read (AI_ASSISTANCE is checked separately). */
export const STAFF_READ_PURPOSES = [
  'CONSULTATION',
  'MEDICATION_MANAGEMENT',
  'LAB_REVIEW',
] as const satisfies readonly PurposeCode[];
export type StaffReadPurpose = (typeof STAFF_READ_PURPOSES)[number];

/** The four kinds of content; every clinical item in the API carries one. */
export const CONTENT_KINDS = ['FACT', 'CALCULATED', 'AI_SUMMARY', 'AI_RECOMMENDATION'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  FACT: 'Recorded',
  CALCULATED: 'Calculated',
  AI_SUMMARY: 'AI summary · check sources',
  AI_RECOMMENDATION: 'AI suggestion · for clinician review',
};

export const RECORD_SOURCES = [
  'CLINICIAN_ENTERED',
  'PATIENT_REPORTED',
  'DEVICE',
  'LAB_FEED',
  'DOCUMENT_EXTRACTION',
  'INTEROP_IMPORT',
  'SYNTHETIC_SEED',
] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const PROVENANCE_VERIFICATIONS = [
  'UNVERIFIED',
  'PATIENT_CONFIRMED',
  'CLINICIAN_VERIFIED',
] as const;
export type ProvenanceVerification = (typeof PROVENANCE_VERIFICATIONS)[number];

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const AI_RECOMMENDATION_TYPES = [
  'DISCUSSION_POINT',
  'QUESTION_FOR_CLINICIAN',
  'FOLLOW_UP_DISCUSSION',
  'DATA_QUALITY_FLAG',
] as const;
export type AiRecommendationType = (typeof AI_RECOMMENDATION_TYPES)[number];

export const AI_INTERACTION_STATUSES = [
  'PENDING',
  'SUCCEEDED',
  'FALLBACK_USED',
  'VALIDATION_FAILED',
  'BLOCKED_BY_CONSENT',
  'BLOCKED_BY_SAFETY',
  'PROVIDER_ERROR',
] as const;
export type AiInteractionStatus = (typeof AI_INTERACTION_STATUSES)[number];

export const AI_PROVIDER_NAMES = ['ANTHROPIC', 'DEMO'] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

/** Reason codes returned by the access decision. */
export const ACCESS_REASONS = [
  'ALLOWED',
  'SELF',
  'DEMOGRAPHICS_ORGANIZATION_SCOPE',
  'NOT_A_MEMBER',
  'PATIENT_NOT_FOUND',
  'ROLE_NOT_PERMITTED',
  'NO_ACTIVE_CONSENT',
  'NO_CARE_RELATIONSHIP',
  'NO_AI_CONSENT',
  'PATIENTS_CANNOT_SIGN',
] as const;
export type AccessReason = (typeof ACCESS_REASONS)[number];
