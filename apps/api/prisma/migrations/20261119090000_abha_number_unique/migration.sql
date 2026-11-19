-- One ABHA number links to one patient record in an organization (ABDM M1:
-- TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER). Rows without a number are unaffected.
CREATE UNIQUE INDEX "PatientProfile_organizationId_abhaNumber_key" ON "PatientProfile"("organizationId", "abhaNumber");
