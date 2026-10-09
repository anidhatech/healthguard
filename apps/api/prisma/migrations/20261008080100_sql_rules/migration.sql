-- Database-level safety rules Prisma's schema language cannot express.
-- Hand-written (created with `prisma migrate dev --create-only`). See
-- docs/DATA_MODEL.md: the database enforces these even if application code
-- has a bug.

-- ---------------------------------------------------------------------------
-- 1. Append-only tables: audit events and provenance links are never changed
--    or deleted. Corrections are new rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hg_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'HG_APPEND_ONLY: % rows are append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION hg_reject_mutation();

CREATE TRIGGER source_provenance_append_only
  BEFORE UPDATE OR DELETE ON "SourceProvenance"
  FOR EACH ROW EXECUTE FUNCTION hg_reject_mutation();

-- TRUNCATE is a statement-level operation; it is reserved for the demo reset,
-- which runs as the table owner inside the seed and is itself audited.

-- ---------------------------------------------------------------------------
-- 2. AI interactions: immutable once completed, never deleted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hg_ai_interaction_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'HG_AI_IMMUTABLE: AI interactions are never deleted' USING ERRCODE = 'P0001';
  END IF;
  IF OLD."completedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'HG_AI_IMMUTABLE: completed AI interaction % cannot change', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_interaction_immutable
  BEFORE UPDATE OR DELETE ON "AIInteraction"
  FOR EACH ROW EXECUTE FUNCTION hg_ai_interaction_guard();

-- ---------------------------------------------------------------------------
-- 3. Signed medication plans: the clinical content of a signed plan never
--    changes. A change is a new version that supersedes it. Only status
--    transitions (and their timestamps) are allowed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hg_protect_signed_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."signedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'HG_SIGNED_PLAN: signed plan % cannot be deleted', OLD.id USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."signedAt" IS NOT NULL AND (
       NEW."medicationId" IS DISTINCT FROM OLD."medicationId"
    OR NEW."doseQuantity" IS DISTINCT FROM OLD."doseQuantity"
    OR NEW."doseUnit" IS DISTINCT FROM OLD."doseUnit"
    OR NEW."route" IS DISTINCT FROM OLD."route"
    OR NEW."frequency" IS DISTINCT FROM OLD."frequency"
    OR NEW."period" IS DISTINCT FROM OLD."period"
    OR NEW."periodUnit" IS DISTINCT FROM OLD."periodUnit"
    OR NEW."timingEvents" IS DISTINCT FROM OLD."timingEvents"
    OR NEW."timingOffsetMinutes" IS DISTINCT FROM OLD."timingOffsetMinutes"
    OR NEW."timesOfDay" IS DISTINCT FROM OLD."timesOfDay"
    OR NEW."asNeeded" IS DISTINCT FROM OLD."asNeeded"
    OR NEW."durationDays" IS DISTINCT FROM OLD."durationDays"
    OR NEW."startDate" IS DISTINCT FROM OLD."startDate"
    OR NEW."prescriberId" IS DISTINCT FROM OLD."prescriberId"
    OR NEW."patientProfileId" IS DISTINCT FROM OLD."patientProfileId"
    OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."signedAt" IS DISTINCT FROM OLD."signedAt"
  ) THEN
    RAISE EXCEPTION 'HG_SIGNED_PLAN: signed plan % is immutable; create a new version', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER medication_plan_signed_immutable
  BEFORE UPDATE OR DELETE ON "MedicationPlan"
  FOR EACH ROW EXECUTE FUNCTION hg_protect_signed_plan();

-- ---------------------------------------------------------------------------
-- 4. Row rules.
-- ---------------------------------------------------------------------------

-- An appointment is never confirmed without the patient's approval.
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_requires_patient_approval
  CHECK (status NOT IN ('CONFIRMED', 'COMPLETED') OR "patientApprovedAt" IS NOT NULL);

-- A signed (active or later) plan always names its prescriber.
ALTER TABLE "MedicationPlan" ADD CONSTRAINT signed_order_has_prescriber
  CHECK ("signedAt" IS NULL OR "prescriberId" IS NOT NULL);

-- A consent's grantee columns match its grantee type.
ALTER TABLE "Consent" ADD CONSTRAINT consent_grantee_matches_type
  CHECK (
    ("granteeType" = 'ORGANIZATION' AND "granteeClinicianId" IS NULL AND "granteeUserId" IS NULL)
    OR ("granteeType" = 'CLINICIAN' AND "granteeClinicianId" IS NOT NULL AND "granteeUserId" IS NULL)
    OR ("granteeType" = 'USER' AND "granteeUserId" IS NOT NULL AND "granteeClinicianId" IS NULL)
  );

-- A consent's validity window is forward in time.
ALTER TABLE "Consent" ADD CONSTRAINT consent_validity_window
  CHECK ("validUntil" > "validFrom");

-- A dose marked taken or skipped records when the answer came in.
ALTER TABLE "MedicationDoseEvent" ADD CONSTRAINT dose_answer_has_time
  CHECK (status NOT IN ('TAKEN', 'SKIPPED') OR "respondedAt" IS NOT NULL);

-- A lab result carries a value.
ALTER TABLE "LabResult" ADD CONSTRAINT lab_result_has_value
  CHECK ("valueNumeric" IS NOT NULL OR "valueText" IS NOT NULL);
