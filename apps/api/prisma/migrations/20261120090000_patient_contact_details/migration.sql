-- Contact details a patient gives at registration, or that come from a verified
-- ABHA profile and are confirmed at the desk. All optional.
ALTER TABLE "PatientProfile"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "pinCode" TEXT;
