-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('DEMO_QUICK_LOGIN', 'PASSWORD', 'OIDC');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('CLINIC', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ORG_ADMIN', 'DOCTOR', 'NURSE', 'CARE_COORDINATOR', 'FRONT_DESK', 'AUDITOR');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('CLINICIAN_ENTERED', 'PATIENT_REPORTED', 'DEVICE', 'LAB_FEED', 'DOCUMENT_EXTRACTION', 'INTEROP_IMPORT', 'SYNTHETIC_SEED');

-- CreateEnum
CREATE TYPE "ProvenanceVerification" AS ENUM ('UNVERIFIED', 'PATIENT_CONFIRMED', 'CLINICIAN_VERIFIED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ENTERED_IN_ERROR');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OUTPATIENT', 'TELECONSULT', 'FOLLOW_UP', 'INPATIENT');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClinicalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ClinicalVerification" AS ENUM ('UNCONFIRMED', 'PROVISIONAL', 'CONFIRMED', 'REFUTED');

-- CreateEnum
CREATE TYPE "AllergyType" AS ENUM ('ALLERGY', 'INTOLERANCE');

-- CreateEnum
CREATE TYPE "AllergyCategory" AS ENUM ('MEDICATION', 'FOOD', 'ENVIRONMENT', 'BIOLOGIC');

-- CreateEnum
CREATE TYPE "AllergyCriticality" AS ENUM ('LOW', 'HIGH', 'UNABLE_TO_ASSESS');

-- CreateEnum
CREATE TYPE "ReactionSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('COMPLETED', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "ImmunizationStatus" AS ENUM ('COMPLETED', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "DoseForm" AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INHALER', 'DROPS', 'CREAM', 'PATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "DoseUnit" AS ENUM ('TABLET', 'CAPSULE', 'ML', 'MG', 'IU', 'PUFF', 'DROP', 'APPLICATION', 'PATCH');

-- CreateEnum
CREATE TYPE "Route" AS ENUM ('ORAL', 'SUBLINGUAL', 'INHALATION', 'SUBCUTANEOUS', 'INTRAMUSCULAR', 'INTRAVENOUS', 'TOPICAL', 'OPHTHALMIC', 'OTIC', 'NASAL', 'TRANSDERMAL', 'RECTAL');

-- CreateEnum
CREATE TYPE "PeriodUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "EventTiming" AS ENUM ('MORN', 'AFT', 'EVE', 'NIGHT', 'HS', 'WAKE', 'C', 'CM', 'CD', 'CV', 'AC', 'ACM', 'ACD', 'ACV', 'PC', 'PCM', 'PCD', 'PCV');

-- CreateEnum
CREATE TYPE "MedicationPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'STOPPED', 'SUPERSEDED', 'ENTERED_IN_ERROR');

-- CreateEnum
CREATE TYPE "InstructionMethod" AS ENUM ('TEMPLATE_ONLY', 'TEMPLATE_PLUS_AI', 'HUMAN_TRANSLATED');

-- CreateEnum
CREATE TYPE "InstructionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('SCHEDULED', 'REMINDED', 'SNOOZED', 'TAKEN', 'SKIPPED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResponseChannel" AS ENUM ('APP', 'WHATSAPP', 'SMS', 'IVR', 'CLINIC', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LabResultStatus" AS ENUM ('PRELIMINARY', 'FINAL', 'AMENDED');

-- CreateEnum
CREATE TYPE "ResultInterpretation" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH');

-- CreateEnum
CREATE TYPE "VitalType" AS ENUM ('BLOOD_PRESSURE', 'HEART_RATE', 'BODY_WEIGHT', 'BODY_HEIGHT', 'BLOOD_GLUCOSE', 'OXYGEN_SATURATION', 'BODY_TEMPERATURE');

-- CreateEnum
CREATE TYPE "ActivityMetricType" AS ENUM ('STEPS', 'SLEEP_DURATION', 'ACTIVE_MINUTES', 'RESTING_HEART_RATE', 'WORKOUT_MINUTES');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LAB_REPORT', 'IMAGING_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'CONSULTATION_NOTE', 'VACCINATION_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'SCANNING', 'CLEAN', 'QUARANTINED', 'EXTRACTING', 'EXTRACTED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('VISIT', 'REPEAT_TEST', 'CALLBACK', 'REVIEW');

-- CreateEnum
CREATE TYPE "FollowUpOrigin" AS ENUM ('CLINICIAN', 'RULE', 'PATIENT_REQUEST');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PLANNED', 'DUE', 'PROPOSED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AppointmentMode" AS ENUM ('IN_PERSON', 'VIDEO', 'PHONE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('REQUESTED', 'GRANTED', 'DENIED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GranteeType" AS ENUM ('ORGANIZATION', 'CLINICIAN', 'USER');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('DEMOGRAPHICS', 'ENCOUNTERS', 'CONDITIONS', 'ALLERGIES', 'HISTORY', 'MEDICATIONS', 'ADHERENCE', 'LABS', 'VITALS', 'ACTIVITY', 'DOCUMENTS', 'CARE_PLAN', 'APPOINTMENTS');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('IN_APP', 'CLINIC_ASSISTED', 'PAPER', 'DEMO_SEED', 'ABDM', 'BREAK_GLASS');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'SIGN', 'EXPORT');

-- CreateEnum
CREATE TYPE "PolicyEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SERVICE', 'AI_AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'STATUS_CHANGE', 'SIGN', 'EXPORT', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ORG_SWITCH', 'CONSENT_REQUEST', 'CONSENT_GRANT', 'CONSENT_DENY', 'CONSENT_REVOKE', 'BREAK_GLASS', 'ACCESS_DENIED', 'AI_INVOKE', 'AI_OUTPUT_RELEASED', 'AI_RECOMMENDATION_REVIEWED', 'DEMO_PERSONA_SWITCH', 'DEMO_CLOCK_CHANGE', 'DEMO_RESET');

-- CreateEnum
CREATE TYPE "AccessDecision" AS ENUM ('ALLOW', 'DENY', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SIMULATED_PHONE', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'VOICE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIAgent" AS ENUM ('ORCHESTRATOR', 'RECORD_INGESTION', 'CLINICAL_TIMELINE', 'MEDICATION_INSTRUCTION', 'MEDICATION_ADHERENCE', 'DOCTOR_BRIEF', 'TREND_ANALYSIS', 'FOLLOW_UP', 'SAFETY', 'CONSENT');

-- CreateEnum
CREATE TYPE "AIProviderName" AS ENUM ('ANTHROPIC', 'DEMO');

-- CreateEnum
CREATE TYPE "AIInteractionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FALLBACK_USED', 'VALIDATION_FAILED', 'BLOCKED_BY_CONSENT', 'BLOCKED_BY_SAFETY', 'PROVIDER_ERROR');

-- CreateEnum
CREATE TYPE "AIRecommendationType" AS ENUM ('DISCUSSION_POINT', 'QUESTION_FOR_CLINICIAN', 'FOLLOW_UP_DISCUSSION', 'DATA_QUALITY_FLAG');

-- CreateEnum
CREATE TYPE "RecommendationAudience" AS ENUM ('CLINICIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ProvenanceSubject" AS ENUM ('AI_CLAIM', 'AI_RECOMMENDATION', 'EXTRACTED_VALUE', 'MEDICATION_INSTRUCTION');

-- CreateEnum
CREATE TYPE "ProvenanceRelation" AS ENUM ('SUPPORTED_BY', 'EXTRACTED_FROM', 'DERIVED_FROM');

-- CreateEnum
CREATE TYPE "SourceEntity" AS ENUM ('ENCOUNTER', 'CONDITION', 'ALLERGY', 'PROCEDURE', 'IMMUNIZATION', 'MEDICATION_PLAN', 'DOSE_EVENT', 'LAB_RESULT', 'VITAL', 'ACTIVITY_METRIC', 'DOCUMENT', 'CARE_PLAN', 'FOLLOW_UP', 'APPOINTMENT', 'CALCULATION');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "displayName" TEXT NOT NULL,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en-IN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "passwordHash" TEXT,
    "oidcIssuer" TEXT,
    "oidcSubject" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeOrganizationId" UUID,
    "refreshTokenHash" TEXT NOT NULL,
    "previousRefreshTokenHash" TEXT,
    "authMethod" "AuthMethod" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgentHash" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "hfrId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roles" "MemberRole"[],
    "status" "MemberStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" UUID,
    "joinedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "specialty" TEXT,
    "qualifications" TEXT,
    "registrationNumber" TEXT,
    "registrationCouncil" TEXT,
    "hprId" TEXT,
    "isPrescriber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClinicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "mrn" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT,
    "dateOfBirth" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "phone" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en-IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dailyRoutine" JSONB NOT NULL,
    "primaryClinicianId" UUID,
    "abhaNumber" TEXT,
    "abhaAddress" TEXT,
    "abhaVerifiedAt" TIMESTAMPTZ(3),
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" UUID NOT NULL,
    "genericName" TEXT NOT NULL,
    "strengthValue" DECIMAL(10,3) NOT NULL,
    "strengthUnit" TEXT NOT NULL,
    "form" "DoseForm" NOT NULL,
    "defaultRoute" "Route" NOT NULL,
    "brandNames" TEXT[],
    "allergenClasses" TEXT[],
    "snomedCode" TEXT,
    "atcCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "loincCode" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "referenceLow" DECIMAL(14,4),
    "referenceHigh" DECIMAL(14,4),
    "referenceText" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentPurpose" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultCategories" "DataCategory"[],
    "defaultDurationDays" INTEGER NOT NULL,
    "abdmPurposeCode" TEXT,
    "requiresPatientAction" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConsentPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "clinicianId" UUID NOT NULL,
    "appointmentId" UUID,
    "type" "EncounterType" NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'PLANNED',
    "reasonForVisit" TEXT,
    "clinicalNotes" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "recordSource" "RecordSource" NOT NULL DEFAULT 'CLINICIAN_ENTERED',
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "codeSystem" TEXT,
    "code" TEXT,
    "display" TEXT NOT NULL,
    "clinicalStatus" "ClinicalStatus" NOT NULL DEFAULT 'ACTIVE',
    "clinicalVerification" "ClinicalVerification" NOT NULL DEFAULT 'CONFIRMED',
    "onsetDate" DATE,
    "abatementDate" DATE,
    "note" TEXT,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "substance" TEXT NOT NULL,
    "substanceCode" TEXT,
    "allergenClass" TEXT,
    "type" "AllergyType" NOT NULL DEFAULT 'ALLERGY',
    "category" "AllergyCategory" NOT NULL,
    "criticality" "AllergyCriticality",
    "clinicalStatus" "ClinicalStatus" NOT NULL DEFAULT 'ACTIVE',
    "clinicalVerification" "ClinicalVerification" NOT NULL DEFAULT 'CONFIRMED',
    "reaction" TEXT,
    "severity" "ReactionSeverity",
    "onsetDate" DATE,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "codeSystem" TEXT,
    "code" TEXT,
    "display" TEXT NOT NULL,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'COMPLETED',
    "performedOn" DATE,
    "performerText" TEXT,
    "facilityText" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "vaccineCode" TEXT,
    "vaccineName" TEXT NOT NULL,
    "status" "ImmunizationStatus" NOT NULL DEFAULT 'COMPLETED',
    "occurredOn" DATE NOT NULL,
    "doseNumber" INTEGER,
    "lotNumber" TEXT,
    "performerText" TEXT,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationPlan" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "medicationId" UUID NOT NULL,
    "prescriberId" UUID,
    "doseQuantity" DECIMAL(10,3) NOT NULL,
    "doseUnit" "DoseUnit" NOT NULL,
    "route" "Route" NOT NULL,
    "frequency" INTEGER NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 1,
    "periodUnit" "PeriodUnit" NOT NULL DEFAULT 'DAY',
    "timingEvents" "EventTiming"[],
    "timingOffsetMinutes" INTEGER,
    "timesOfDay" TEXT[],
    "asNeeded" BOOLEAN NOT NULL DEFAULT false,
    "durationDays" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "indication" TEXT,
    "specialInstructions" TEXT,
    "status" "MedicationPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "signedAt" TIMESTAMPTZ(3),
    "stoppedAt" TIMESTAMPTZ(3),
    "stopReason" TEXT,
    "recordSource" "RecordSource" NOT NULL DEFAULT 'CLINICIAN_ENTERED',
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'CLINICIAN_VERIFIED',
    "recordedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MedicationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationInstruction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "medicationPlanId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "doseText" TEXT NOT NULL,
    "notesText" TEXT,
    "method" "InstructionMethod" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "aiInteractionId" UUID,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationReport" JSONB,
    "status" "InstructionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "audioObjectKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MedicationInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationDoseEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "medicationPlanId" UUID NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "status" "DoseStatus" NOT NULL DEFAULT 'SCHEDULED',
    "remindAt" TIMESTAMPTZ(3) NOT NULL,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" TIMESTAMPTZ(3),
    "respondedAt" TIMESTAMPTZ(3),
    "responseChannel" "ResponseChannel",
    "respondedByUserId" UUID,
    "skipReason" TEXT,
    "missedInferred" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "recordSource" "RecordSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MedicationDoseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "labTestId" UUID NOT NULL,
    "encounterId" UUID,
    "documentId" UUID,
    "followUpId" UUID,
    "valueNumeric" DECIMAL(14,4),
    "valueText" TEXT,
    "unit" TEXT NOT NULL,
    "referenceLow" DECIMAL(14,4),
    "referenceHigh" DECIMAL(14,4),
    "interpretation" "ResultInterpretation",
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3),
    "status" "LabResultStatus" NOT NULL DEFAULT 'FINAL',
    "performingLab" TEXT,
    "extractionConfidence" DECIMAL(4,3),
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vital" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "type" "VitalType" NOT NULL,
    "value" DECIMAL(10,3) NOT NULL,
    "value2" DECIMAL(10,3),
    "unit" TEXT NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "context" TEXT,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "verification" "ProvenanceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "recordedByUserId" UUID,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityMetric" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "type" "ActivityMetricType" NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRef" TEXT,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActivityMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "documentDate" DATE,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "scanResult" TEXT,
    "isSyntheticSample" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" UUID,
    "recordSource" "RecordSource" NOT NULL,
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "encounterId" UUID,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "goals" JSONB NOT NULL DEFAULT '[]',
    "status" "CarePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "carePlanId" UUID,
    "labTestId" UUID,
    "assignedMemberId" UUID,
    "type" "FollowUpType" NOT NULL,
    "origin" "FollowUpOrigin" NOT NULL,
    "reason" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "windowStart" DATE,
    "windowEnd" DATE,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PLANNED',
    "createdByUserId" UUID,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "clinicianId" UUID NOT NULL,
    "followUpId" UUID,
    "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "proposedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientApprovedAt" TIMESTAMPTZ(3),
    "patientApprovedByUserId" UUID,
    "confirmedAt" TIMESTAMPTZ(3),
    "confirmedByUserId" UUID,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "purposeId" UUID NOT NULL,
    "granteeType" "GranteeType" NOT NULL,
    "granteeClinicianId" UUID,
    "granteeUserId" UUID,
    "categories" "DataCategory"[],
    "dataFrom" DATE,
    "dataTo" DATE,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'REQUESTED',
    "method" "ConsentMethod" NOT NULL,
    "requestedByUserId" UUID,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "revokedReason" TEXT,
    "justificationCode" TEXT,
    "noticeVersion" TEXT NOT NULL,
    "noticeLocale" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "role" "MemberRole" NOT NULL,
    "category" "DataCategory" NOT NULL,
    "actions" "AccessAction"[],
    "purposeId" UUID,
    "requiresCareRelationship" BOOLEAN NOT NULL DEFAULT true,
    "effect" "PolicyEffect" NOT NULL DEFAULT 'ALLOW',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "actorRoles" TEXT[],
    "onBehalfOfUserId" UUID,
    "aiAgent" "AIAgent",
    "patientProfileId" UUID,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID,
    "purposeCode" TEXT,
    "consentId" UUID,
    "decision" "AccessDecision" NOT NULL,
    "decisionReason" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "patientProfileId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "readAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteraction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "agent" "AIAgent" NOT NULL,
    "task" TEXT NOT NULL,
    "purposeCode" TEXT NOT NULL,
    "consentIds" UUID[],
    "provider" "AIProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "inputFactIds" UUID[],
    "inputHash" TEXT NOT NULL,
    "output" JSONB,
    "status" "AIInteractionStatus" NOT NULL DEFAULT 'PENDING',
    "validation" JSONB,
    "fallbackReason" TEXT,
    "confidence" "Confidence",
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicroUsd" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "aiInteractionId" UUID NOT NULL,
    "type" "AIRecommendationType" NOT NULL,
    "audience" "RecommendationAudience" NOT NULL DEFAULT 'CLINICIAN',
    "text" TEXT NOT NULL,
    "rationale" TEXT,
    "confidence" "Confidence" NOT NULL,
    "status" "AIRecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceProvenance" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "subjectType" "ProvenanceSubject" NOT NULL,
    "subjectId" UUID NOT NULL,
    "claimKey" TEXT,
    "relationType" "ProvenanceRelation" NOT NULL,
    "sourceType" "SourceEntity" NOT NULL,
    "sourceId" UUID,
    "sourceLocator" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcIssuer_oidcSubject_key" ON "User"("oidcIssuer", "oidcSubject");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_previousRefreshTokenHash_key" ON "AuthSession"("previousRefreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_hfrId_key" ON "Organization"("hfrId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_id_key" ON "OrganizationMember"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianProfile_organizationId_memberId_key" ON "ClinicianProfile"("organizationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianProfile_organizationId_id_key" ON "ClinicianProfile"("organizationId", "id");

-- CreateIndex
CREATE INDEX "PatientProfile_userId_idx" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_organizationId_id_key" ON "PatientProfile"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_organizationId_mrn_key" ON "PatientProfile"("organizationId", "mrn");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_organizationId_abhaAddress_key" ON "PatientProfile"("organizationId", "abhaAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Medication_genericName_strengthValue_strengthUnit_form_key" ON "Medication"("genericName", "strengthValue", "strengthUnit", "form");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_code_key" ON "LabTest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_loincCode_key" ON "LabTest"("loincCode");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentPurpose_code_key" ON "ConsentPurpose"("code");

-- CreateIndex
CREATE INDEX "Encounter_organizationId_patientProfileId_startedAt_idx" ON "Encounter"("organizationId", "patientProfileId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_organizationId_id_key" ON "Encounter"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_organizationId_appointmentId_key" ON "Encounter"("organizationId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Condition_supersedesId_key" ON "Condition"("supersedesId");

-- CreateIndex
CREATE INDEX "Condition_organizationId_patientProfileId_clinicalStatus_idx" ON "Condition"("organizationId", "patientProfileId", "clinicalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Allergy_supersedesId_key" ON "Allergy"("supersedesId");

-- CreateIndex
CREATE INDEX "Allergy_organizationId_patientProfileId_clinicalStatus_idx" ON "Allergy"("organizationId", "patientProfileId", "clinicalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Procedure_supersedesId_key" ON "Procedure"("supersedesId");

-- CreateIndex
CREATE INDEX "Procedure_organizationId_patientProfileId_performedOn_idx" ON "Procedure"("organizationId", "patientProfileId", "performedOn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Immunization_supersedesId_key" ON "Immunization"("supersedesId");

-- CreateIndex
CREATE INDEX "Immunization_organizationId_patientProfileId_occurredOn_idx" ON "Immunization"("organizationId", "patientProfileId", "occurredOn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MedicationPlan_supersedesId_key" ON "MedicationPlan"("supersedesId");

-- CreateIndex
CREATE INDEX "MedicationPlan_organizationId_patientProfileId_status_idx" ON "MedicationPlan"("organizationId", "patientProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationPlan_organizationId_id_key" ON "MedicationPlan"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationPlan_organizationId_patientProfileId_id_key" ON "MedicationPlan"("organizationId", "patientProfileId", "id");

-- CreateIndex
CREATE INDEX "MedicationInstruction_organizationId_status_idx" ON "MedicationInstruction"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationInstruction_medicationPlanId_locale_revision_key" ON "MedicationInstruction"("medicationPlanId", "locale", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "one_approved_instruction_per_locale" ON "MedicationInstruction"("medicationPlanId", "locale") WHERE (status = 'APPROVED');

-- CreateIndex
CREATE UNIQUE INDEX "MedicationDoseEvent_idempotencyKey_key" ON "MedicationDoseEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MedicationDoseEvent_status_remindAt_idx" ON "MedicationDoseEvent"("status", "remindAt");

-- CreateIndex
CREATE INDEX "MedicationDoseEvent_organizationId_patientProfileId_schedul_idx" ON "MedicationDoseEvent"("organizationId", "patientProfileId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationDoseEvent_medicationPlanId_scheduledAt_key" ON "MedicationDoseEvent"("medicationPlanId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_supersedesId_key" ON "LabResult"("supersedesId");

-- CreateIndex
CREATE INDEX "LabResult_organizationId_patientProfileId_labTestId_effecti_idx" ON "LabResult"("organizationId", "patientProfileId", "labTestId", "effectiveAt" DESC);

-- CreateIndex
CREATE INDEX "Vital_organizationId_patientProfileId_type_measuredAt_idx" ON "Vital"("organizationId", "patientProfileId", "type", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityMetric_organizationId_patientProfileId_type_date_idx" ON "ActivityMetric"("organizationId", "patientProfileId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityMetric_patientProfileId_type_date_sourceSystem_key" ON "ActivityMetric"("patientProfileId", "type", "date", "sourceSystem");

-- CreateIndex
CREATE UNIQUE INDEX "Document_objectKey_key" ON "Document"("objectKey");

-- CreateIndex
CREATE INDEX "Document_organizationId_patientProfileId_createdAt_idx" ON "Document"("organizationId", "patientProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_organizationId_sha256_idx" ON "Document"("organizationId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Document_organizationId_id_key" ON "Document"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CarePlan_organizationId_patientProfileId_status_idx" ON "CarePlan"("organizationId", "patientProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CarePlan_organizationId_id_key" ON "CarePlan"("organizationId", "id");

-- CreateIndex
CREATE INDEX "FollowUp_organizationId_status_dueDate_idx" ON "FollowUp"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FollowUp_organizationId_patientProfileId_dueDate_idx" ON "FollowUp"("organizationId", "patientProfileId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_organizationId_id_key" ON "FollowUp"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_clinicianId_startAt_idx" ON "Appointment"("organizationId", "clinicianId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_patientProfileId_startAt_idx" ON "Appointment"("organizationId", "patientProfileId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_organizationId_id_key" ON "Appointment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Consent_organizationId_patientProfileId_status_validUntil_idx" ON "Consent"("organizationId", "patientProfileId", "status", "validUntil");

-- CreateIndex
CREATE INDEX "Consent_granteeClinicianId_status_idx" ON "Consent"("granteeClinicianId", "status");

-- CreateIndex
CREATE INDEX "Consent_granteeUserId_status_idx" ON "Consent"("granteeUserId", "status");

-- CreateIndex
CREATE INDEX "AccessPolicy_organizationId_role_category_idx" ON "AccessPolicy"("organizationId", "role", "category");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_occurredAt_idx" ON "AuditEvent"("organizationId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_patientProfileId_occurredAt_idx" ON "AuditEvent"("patientProfileId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_status_scheduledFor_idx" ON "Notification"("recipientUserId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Notification_organizationId_status_scheduledFor_idx" ON "Notification"("organizationId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AIInteraction_organizationId_patientProfileId_createdAt_idx" ON "AIInteraction"("organizationId", "patientProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIInteraction_organizationId_agent_status_createdAt_idx" ON "AIInteraction"("organizationId", "agent", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AIInteraction_organizationId_id_key" ON "AIInteraction"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AIRecommendation_organizationId_patientProfileId_status_idx" ON "AIRecommendation"("organizationId", "patientProfileId", "status");

-- CreateIndex
CREATE INDEX "SourceProvenance_organizationId_subjectType_subjectId_idx" ON "SourceProvenance"("organizationId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "SourceProvenance_organizationId_sourceType_sourceId_idx" ON "SourceProvenance"("organizationId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianProfile" ADD CONSTRAINT "ClinicianProfile_organizationId_memberId_fkey" FOREIGN KEY ("organizationId", "memberId") REFERENCES "OrganizationMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_organizationId_primaryClinicianId_fkey" FOREIGN KEY ("organizationId", "primaryClinicianId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organizationId_clinicianId_fkey" FOREIGN KEY ("organizationId", "clinicianId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organizationId_appointmentId_fkey" FOREIGN KEY ("organizationId", "appointmentId") REFERENCES "Appointment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_organizationId_prescriberId_fkey" FOREIGN KEY ("organizationId", "prescriberId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "MedicationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationInstruction" ADD CONSTRAINT "MedicationInstruction_organizationId_medicationPlanId_fkey" FOREIGN KEY ("organizationId", "medicationPlanId") REFERENCES "MedicationPlan"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationInstruction" ADD CONSTRAINT "MedicationInstruction_organizationId_aiInteractionId_fkey" FOREIGN KEY ("organizationId", "aiInteractionId") REFERENCES "AIInteraction"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationDoseEvent" ADD CONSTRAINT "MedicationDoseEvent_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationDoseEvent" ADD CONSTRAINT "MedicationDoseEvent_organizationId_patientProfileId_medica_fkey" FOREIGN KEY ("organizationId", "patientProfileId", "medicationPlanId") REFERENCES "MedicationPlan"("organizationId", "patientProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_organizationId_documentId_fkey" FOREIGN KEY ("organizationId", "documentId") REFERENCES "Document"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_organizationId_followUpId_fkey" FOREIGN KEY ("organizationId", "followUpId") REFERENCES "FollowUp"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMetric" ADD CONSTRAINT "ActivityMetric_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_organizationId_encounterId_fkey" FOREIGN KEY ("organizationId", "encounterId") REFERENCES "Encounter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_organizationId_authorId_fkey" FOREIGN KEY ("organizationId", "authorId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_organizationId_carePlanId_fkey" FOREIGN KEY ("organizationId", "carePlanId") REFERENCES "CarePlan"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_organizationId_assignedMemberId_fkey" FOREIGN KEY ("organizationId", "assignedMemberId") REFERENCES "OrganizationMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_clinicianId_fkey" FOREIGN KEY ("organizationId", "clinicianId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_followUpId_fkey" FOREIGN KEY ("organizationId", "followUpId") REFERENCES "FollowUp"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "ConsentPurpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_organizationId_granteeClinicianId_fkey" FOREIGN KEY ("organizationId", "granteeClinicianId") REFERENCES "ClinicianProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicy" ADD CONSTRAINT "AccessPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicy" ADD CONSTRAINT "AccessPolicy_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "ConsentPurpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_organizationId_aiInteractionId_fkey" FOREIGN KEY ("organizationId", "aiInteractionId") REFERENCES "AIInteraction"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceProvenance" ADD CONSTRAINT "SourceProvenance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
