# HealthGuard — FHIR R4 Mapping

> **Status:** technical design (Step 2). No application code yet.
> **Scope:** the Phase 1 demo export, and the production integration it prepares for.
> **Data:** synthetic only. Exports are tagged as synthetic. HealthGuard is not ABDM-certified; this is an integration-ready boundary.
>
> Related: [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [Data model](DATA_MODEL.md) · [Security](SECURITY.md) · [AI agents](AI_AGENT_SPEC.md) · [ABDM integration](ABDM_INTEGRATION.md) · [Roadmap](ROADMAP.md)

## 1. Stance

- HealthGuard's internal model is relational ([Data model](DATA_MODEL.md)). FHIR R4 (4.0.1) is produced and consumed at the edges by a mapper in `packages/shared/fhir`, used by the `interoperability` module. FHIR is never the system of record.
- **Phase 1 demo:** export only. `GET /api/v1/patients/{id}/fhir/export` (the patient, or a doctor in their care) returns a `Bundle` of type `collection` with base R4 resources for one patient, limited to the data categories the caller may see. Implemented in Phase 1: Patient, Organization, PractitionerRole (minimal), Encounter, Condition, AllergyIntolerance, MedicationRequest / MedicationStatement (with translated patient instructions), Observation (laboratory, vital signs, activity), DiagnosticReport (per uploaded report), Immunization, Procedure, Appointment. Not yet exported: CarePlan / ServiceRequest, DocumentReference. `fullUrl` uses the reserved base `https://fhir.healthguard.invalid` so relative references resolve within the Bundle. Every resource carries a `SYNTHETIC` tag. There is no FHIR server and no import. Each export writes an `EXPORT` audit event.
- **Future production (Phase 3+):** ABDM document bundles that follow the [FHIR Implementation Guide for ABDM](https://nrces.in/ndhm/fhir/r4/index.html) published by NRCeS (version 6.5.0, based on FHIR R4 4.0.1): Composition-based records (`OPConsultRecord`, `PrescriptionRecord`, `DiagnosticReportRecord`, `ImmunizationRecord`, `WellnessRecord`, `HealthDocumentRecord`, `DischargeSummaryRecord`) packaged in a `DocumentBundle`; imports from laboratory and hospital feeds; validation against the guide's package.
- The adapter architecture that connects this mapper to ABDM is drawn in [ABDM integration §1](ABDM_INTEGRATION.md#1-where-abdm-integration-belongs).

## 2. Overview

| HealthGuard entity | FHIR R4 resource | Phase 1 export | Production use |
|---|---|---|---|
| `PatientProfile` | Patient | Yes | Adds ABHA identifiers |
| `ClinicianProfile` | Practitioner, PractitionerRole | Minimal | Adds HPR ID |
| `Organization` | Organization | Yes | Adds HFR ID |
| `Encounter` | Encounter | Yes | Inside `OPConsultRecord` |
| `LabResult` | Observation (laboratory) | Yes | Inside `DiagnosticReportRecord` |
| `Vital` | Observation (vital-signs) | Yes | Inside `WellnessRecord` |
| `ActivityMetric` | Observation (activity) | Yes | Inside `WellnessRecord` |
| Results from one report or feed | DiagnosticReport | Yes | `DiagnosticReportRecord` |
| `MedicationPlan` entered by a clinician | MedicationRequest | Yes | `PrescriptionRecord` |
| `MedicationPlan` reported by the patient | MedicationStatement | Yes | Medication history |
| `MedicationInstruction` | `MedicationRequest.dosageInstruction.patientInstruction`, with translations | Yes | Same |
| `MedicationDoseEvent` | MedicationAdministration | No | Sharing recorded doses (Phase 3) |
| `Allergy` | AllergyIntolerance | Yes | Inside `OPConsultRecord` |
| `Procedure` | Procedure | Yes | `OPConsultRecord`, `DischargeSummaryRecord` |
| `Immunization` | Immunization | Yes | `ImmunizationRecord` |
| `Condition` | Condition | Yes | Inside `OPConsultRecord` |
| `CarePlan`, `FollowUp` | CarePlan, with ServiceRequest for repeat tests | Yes | Follow-up section of `OPConsultRecord` |
| `Appointment` | Appointment | Yes | Scheduling integrations |
| `Document` | DocumentReference (Binary in production) | Metadata and a short-lived link | `HealthDocumentRecord` |
| `Consent` | Consent | No | Mapped to and from ABDM consent artefacts |
| `AuditEvent` | AuditEvent | No | Phase 3 |
| `AIInteraction`, `SourceProvenance` | Provenance | No | Phase 3 |

## 3. Conventions

- `Resource.id` is the HealthGuard UUID; references are relative (`Patient/{id}`).
- External identifiers go in `identifier`: the MRN uses the system `urn:healthguard:{organizationSlug}:mrn`; ABHA identifiers use the systems the NRCeS guide defines (production only).
- `meta.tag` in Phase 1, on the Bundle and on every resource, carries the demo banner text: `{ "system": "urn:healthguard:tags", "code": "SYNTHETIC", "display": "DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE" }`.
- `meta.source` carries the row's provenance as `urn:healthguard:source:{recordSource}`, so a consumer can tell clinician-entered, patient-reported and device data apart.
- Times are exported in UTC; date-only facts use FHIR `date`. Quantities use UCUM (`http://unitsofmeasure.org`).
- Terminology: LOINC (`http://loinc.org`) for labs, vitals and activity; ICD-10 (`http://hl7.org/fhir/sid/icd-10`) or SNOMED CT (`http://snomed.info/sct`) for conditions and procedures; FHIR `EventTiming`; HL7 v3 `ActCode` for encounter class; `observation-category`; v3 `ObservationInterpretation`. Where the demo has no standard code, a local system `urn:healthguard:code:{name}` is used and marked as such.
- Rows with `recordStatus = ENTERED_IN_ERROR` are exported with the resource's `entered-in-error` status, never silently dropped.
- Phase 1 does not generate narrative (`text`); production generates it as the guide requires.

## 4. Resource mappings

### 4.1 Patient ← `PatientProfile`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `id` | `Patient.id` | |
| `mrn` | `identifier` (system `urn:healthguard:{org}:mrn`) | |
| `abhaNumber`, `abhaAddress` | `identifier` | Production, only after verification through ABDM |
| `givenName`, `familyName` | `name[0].given`, `name[0].family` | |
| `dateOfBirth` | `birthDate` | |
| `sex` | `gender` | `FEMALE` → `female`, `MALE` → `male`, `OTHER` → `other`, `UNKNOWN` → `unknown` |
| `phone` | `telecom` (system `phone`) | Exported only to authorized consumers |
| `preferredLocale` | `communication[0].language` (BCP 47), `preferred = true` | |
| `status` | `active`, `deceasedBoolean` | `ACTIVE` → `active = true`; `INACTIVE` → `active = false`; `DECEASED` → `active = false` and `deceasedBoolean = true` |
| `organizationId` | `managingOrganization` | |
| `primaryClinicianId` | `generalPractitioner` | PractitionerRole |

Demo: base R4 Patient. Production: the NRCeS Patient profile with ABHA identifiers.

### 4.2 Encounter ← `Encounter`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `PLANNED` → `planned`, `IN_PROGRESS` → `in-progress`, `COMPLETED` → `finished`, `CANCELLED` → `cancelled` |
| `type` | `class` (v3 ActCode) | `OUTPATIENT` and `FOLLOW_UP` → `AMB`, `TELECONSULT` → `VR`, `INPATIENT` → `IMP`; `FOLLOW_UP` also sets `type.text` |
| `reasonForVisit` | `reasonCode[0].text` | |
| `startedAt`, `endedAt` | `period.start`, `period.end` | |
| `clinicianId` | `participant[0].individual` | PractitionerRole |
| `appointmentId` | `appointment` | |
| `patientProfileId` | `subject` | |
| `organizationId` | `serviceProvider` | |
| `clinicalNotes` | not exported in Phase 1 | Production: Composition sections per the guide |

### 4.3 Observation ← `LabResult`, `Vital`, `ActivityMetric`

**Laboratory results**

| HealthGuard | FHIR | Notes |
|---|---|---|
| `labTest.loincCode` | `code.coding` (LOINC) | HbA1c is `4548-4` |
| `valueNumeric`, `unit` | `valueQuantity` (UCUM) | |
| `valueText` | `valueString` | |
| `referenceLow`, `referenceHigh` | `referenceRange[0].low`, `.high` | |
| `interpretation` | `interpretation` (v3 ObservationInterpretation) | `LOW` → `L`, `NORMAL` → `N`, `HIGH` → `H`, `CRITICAL_LOW` → `LL`, `CRITICAL_HIGH` → `HH` |
| `effectiveAt` | `effectiveDateTime` | Sample time |
| `issuedAt` | `issued` | |
| `status` | `status` | `PRELIMINARY` → `preliminary`, `FINAL` → `final`, `AMENDED` → `amended` |
| (fixed) | `category` = `laboratory` | |
| `performingLab` | `performer[0].display` | |
| `encounterId` | `encounter` | |

**Vitals** (`category` = `vital-signs`; codes from the FHIR vital-signs profiles)

| `Vital.type` | LOINC code | Unit |
|---|---|---|
| `BLOOD_PRESSURE` | `85354-9` panel, with components `8480-6` (systolic, from `value`) and `8462-4` (diastolic, from `value2`) | `mm[Hg]` |
| `BODY_WEIGHT` | `29463-7` | `kg` |
| `HEART_RATE` | `8867-4` | `/min` |
| `BODY_HEIGHT` | `8302-2` | `cm` |
| `OXYGEN_SATURATION` | `2708-6` | `%` |
| `BODY_TEMPERATURE` | `8310-5` | `Cel` |
| `BLOOD_GLUCOSE` | Local code in the demo; in production the LOINC code that matches the specimen and method | `mg/dL` |

`measuredAt` → `effectiveDateTime`; `context` (for example fasting) → `note` in the demo.

**Activity** (`category` = `activity`)

| `ActivityMetric.type` | Code | Unit |
|---|---|---|
| `STEPS` | LOINC `41950-7`, "Number of steps in 24 hour Measured" | `{steps}` |
| `SLEEP_DURATION` | LOINC `93832-4`, "Sleep duration" | `h` |
| `ACTIVE_MINUTES`, `RESTING_HEART_RATE`, `WORKOUT_MINUTES` | Local codes in the demo | `min`, `/min`, `min` |

`date` → `effectivePeriod` covering the patient's local day; `sourceSystem` → `meta.source` and `device.display`.

### 4.4 DiagnosticReport ← results from one report or feed

| HealthGuard | FHIR | Notes |
|---|---|---|
| Results sharing a `documentId`, or the same lab and issue time | `result[]` | References to the Observations |
| (fixed) | `status` = `final`; `category` = `LAB` | |
| Report title | `code.text` | Production: the panel's LOINC code where one exists |
| Earliest `effectiveAt`, latest `issuedAt` | `effectiveDateTime`, `issued` | |
| `performingLab` | `performer` | |
| `documentId` | `presentedForm` in production; a DocumentReference link in the demo | |

### 4.5 MedicationRequest ← `MedicationPlan` (`recordSource = CLINICIAN_ENTERED`)

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `ACTIVE` → `active`, `ON_HOLD` → `on-hold`, `COMPLETED` → `completed`, `STOPPED` → `stopped`, `SUPERSEDED` → `stopped` with `statusReason` "superseded", `ENTERED_IN_ERROR` → `entered-in-error`; drafts are not exported |
| (fixed) | `intent` = `order` | |
| `medication` | `medicationCodeableConcept` | Demo: `text` plus the local catalogue code. Production: SNOMED CT or national drug codes as the guide binds them |
| `patientProfileId`, `encounterId` | `subject`, `encounter` | |
| `signedAt` | `authoredOn` | |
| `prescriberId` | `requester` | PractitionerRole |
| `indication` | `reasonCode[0].text` | |
| `supersedesId` | `priorPrescription` on the newer request | |
| `doseQuantity`, `doseUnit` | `dosageInstruction[0].doseAndRate[0].doseQuantity` | |
| `route` | `dosageInstruction[0].route` | Demo: `text`. Production: SNOMED CT route code |
| `frequency`, `period`, `periodUnit` | `timing.repeat.frequency`, `.period`, `.periodUnit` | `DAY` → `d`, `WEEK` → `wk`, `MONTH` → `mo` |
| `timingEvents` | `timing.repeat.when` | e.g. `PCM` |
| `timingOffsetMinutes` | `timing.repeat.offset` | Minutes |
| `timesOfDay` | `timing.repeat.timeOfDay` | |
| `startDate`, `durationDays` | `timing.repeat.boundsPeriod` | Start and computed end |
| `asNeeded` | `dosageInstruction[0].asNeededBoolean` | |
| `specialInstructions` | `dosageInstruction[0].additionalInstruction[0].text` | The doctor's own words |
| Clinician summary of the dose | `dosageInstruction[0].text` | Generated deterministically, e.g. "1 tablet orally, once daily, 15 minutes after breakfast, for 90 days" |
| `MedicationInstruction` (`en-IN`) | `dosageInstruction[0].patientInstruction` | |
| `MedicationInstruction` (`hi-IN`, `te-IN`) | `translation` extensions on `patientInstruction` | `http://hl7.org/fhir/StructureDefinition/translation` with `lang` and `content` |

### 4.6 MedicationStatement ← `MedicationPlan` (`recordSource = PATIENT_REPORTED`)

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `ACTIVE` → `active`, `STOPPED` → `stopped`, `COMPLETED` → `completed`, `ENTERED_IN_ERROR` → `entered-in-error` |
| `medication` | `medicationCodeableConcept` | |
| `startDate`, `endDate` | `effectivePeriod` | |
| `createdAt` | `dateAsserted` | |
| (fixed) | `informationSource` = the Patient | |
| Dose fields, if given | `dosage[0]` | As in MedicationRequest |

FHIR R4 has no adherence element (R5 adds one). Recorded doses are therefore exported individually as MedicationAdministration in production (section 4.14), not summarized in MedicationStatement.

### 4.7 AllergyIntolerance ← `Allergy`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `type` | `type` | `allergy` or `intolerance` |
| `category` | `category` | `medication`, `food`, `environment`, `biologic` |
| `criticality` | `criticality` | `low`, `high`, `unable-to-assess` |
| `clinicalStatus` | `clinicalStatus` | `active`, `inactive`, `resolved` |
| `clinicalVerification` | `verificationStatus` | `UNCONFIRMED` and `PROVISIONAL` → `unconfirmed`, `CONFIRMED` → `confirmed`, `REFUTED` → `refuted`; a row whose record status is `ENTERED_IN_ERROR` → `entered-in-error` |
| `substance` | `code.text` | Production: coded substance |
| `reaction`, `severity` | `reaction[0].manifestation[0].text`, `reaction[0].severity` | `mild`, `moderate`, `severe` |
| `onsetDate` | `onsetDateTime` | |
| `createdAt`, `recordedByUserId` | `recordedDate`, `recorder` | |

### 4.8 Procedure ← `Procedure`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `COMPLETED` → `completed`, `NOT_DONE` → `not-done` |
| `codeSystem`, `code`, `display` | `code` | Production: SNOMED CT |
| `performedOn` | `performedDateTime` | |
| `performerText`, `facilityText` | `performer[0].actor.display`, `location.display` | |
| `outcome`, `note` | `outcome.text`, `note[0].text` | |

### 4.9 Immunization ← `Immunization`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `completed`, `not-done` |
| `vaccineName`, `vaccineCode` | `vaccineCode` | Production: codes as the guide binds them |
| `occurredOn` | `occurrenceDateTime` | |
| `doseNumber` | `protocolApplied[0].doseNumberPositiveInt` | |
| `lotNumber` | `lotNumber` | |
| `performerText` | `performer[0].actor.display` | |
| `recordSource` | `primarySource` (`true` when clinician-entered), otherwise `reportOrigin` | |

### 4.10 Condition ← `Condition`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `clinicalStatus` | `clinicalStatus` | `active`, `inactive`, `resolved` |
| `clinicalVerification` | `verificationStatus` | `unconfirmed`, `provisional`, `confirmed`, `refuted` |
| `codeSystem`, `code`, `display` | `code.coding`, `code.text` | Demo: ICD-10 `E11` (type 2 diabetes mellitus), `I10` (essential hypertension) |
| `encounterId` | `encounter`; `category` = `encounter-diagnosis` | Otherwise `category` = `problem-list-item` |
| `onsetDate`, `abatementDate` | `onsetDateTime`, `abatementDateTime` | |
| `note` | `note[0].text` | |

### 4.11 CarePlan ← `CarePlan` and `FollowUp`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `DRAFT` → `draft`, `ACTIVE` → `active`, `COMPLETED` → `completed`, `REVOKED` → `revoked` |
| (fixed) | `intent` = `plan` | |
| `title`, `goals` | `title`, `description` | Production: Goal resources |
| `startDate`, `endDate` | `period` | |
| `authorId`, `encounterId` | `author`, `encounter` | |
| `FollowUp` of type `VISIT` | `activity[].detail` (kind `Appointment`, `scheduledPeriod` = due window, `description` = reason) | |
| `FollowUp` of type `REPEAT_TEST` | `activity[].detail` (kind `ServiceRequest`, `code` = the test's LOINC) in the demo; a ServiceRequest resource in production | |
| `FollowUp` of type `CALLBACK` or `REVIEW` | `activity[].detail` in the demo; Task in production | |
| `FollowUp.status` | `activity[].detail.status` | `PLANNED`, `DUE`, `PROPOSED`, `OVERDUE` → `not-started`; `SCHEDULED` → `scheduled`; `COMPLETED` → `completed`; `CANCELLED` → `cancelled` |

### 4.12 Appointment ← `Appointment`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `status` | `status` | `PROPOSED` → `proposed`, `PATIENT_APPROVED` → `pending`, `CONFIRMED` → `booked`, `COMPLETED` → `fulfilled`, `CANCELLED` → `cancelled`, `NO_SHOW` → `noshow` |
| `patientApprovedAt` | `participant` (Patient) `status` | `needs-action` before approval, `accepted` after |
| `confirmedAt` | `participant` (PractitionerRole) `status` | `accepted` when confirmed |
| `startAt`, `endAt` | `start`, `end` | |
| `reason` | `reasonCode[0].text` | |
| `mode` | `appointmentType.text` in the demo | Production: a code or extension the guide or partner requires |
| `followUpId` | `basedOn` | Production: the ServiceRequest |
| `proposedAt` | `created` | |

### 4.13 DocumentReference ← `Document`

| HealthGuard | FHIR | Notes |
|---|---|---|
| `recordStatus` | `status` | `ACTIVE` → `current`, `ENTERED_IN_ERROR` → `entered-in-error` |
| `status` | `docStatus` | `final` once scanned clean |
| `type` | `type` | Demo: local code. Production: the document-type value set the guide binds |
| `title` | `description` | |
| `documentDate`, `createdAt` | `context.period.start`, `date` | |
| `mimeType`, `sizeBytes` | `content[0].attachment.contentType`, `.size` | |
| `sha256` | not mapped directly | R4 `Attachment.hash` is SHA-1; the exporter computes it at export time |
| `objectKey` | `content[0].attachment.url` | A signed URL valid for five minutes in the demo; a Binary inside the bundle in production |
| `encounterId`, `uploadedByUserId` | `context.encounter`, `author` | |

### 4.14 Production-only mappings

| HealthGuard | FHIR | Use |
|---|---|---|
| `ClinicianProfile`, `OrganizationMember` | Practitioner, PractitionerRole | With HPR ID and registration number |
| `Organization` | Organization | With HFR ID |
| `MedicationDoseEvent` | MedicationAdministration | `TAKEN` → `completed`; `SKIPPED` and `MISSED` → `not-done` with `statusReason`; `respondedAt` → `effectiveDateTime`; performer = Patient; `request` = the MedicationRequest |
| `Consent` | Consent | Mapped to and from ABDM consent artefacts ([ABDM integration §4](ABDM_INTEGRATION.md#4-consent-boundary)) |
| `AIInteraction`, `SourceProvenance` | Provenance | `target` = the generated statement or Composition section; `agent` = a Device representing HealthGuard AI with model and prompt version; `entity` = the cited sources |
| `AuditEvent` | AuditEvent | For partners that require FHIR-shaped audit exchange |

## 5. Worked examples

### 5.1 Ananya's Metformin order

```json
{
  "resourceType": "MedicationRequest",
  "id": "0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a21",
  "meta": {
    "source": "urn:healthguard:source:CLINICIAN_ENTERED",
    "tag": [{ "system": "urn:healthguard:tags", "code": "SYNTHETIC", "display": "DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE" }]
  },
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{ "system": "urn:healthguard:code:medication", "code": "metformin-500-tab" }],
    "text": "Metformin 500 mg tablet"
  },
  "subject": { "reference": "Patient/0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a02" },
  "encounter": { "reference": "Encounter/0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a01" },
  "authoredOn": "2026-07-08T05:10:00Z",
  "requester": { "reference": "PractitionerRole/0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a03" },
  "reasonCode": [{ "text": "Type 2 diabetes mellitus" }],
  "dosageInstruction": [{
    "text": "1 tablet orally, once daily, 15 minutes after breakfast, for 90 days",
    "patientInstruction": "Take 1 tablet of Metformin 500 mg, 15 minutes after breakfast. Once a day, for 90 days.",
    "_patientInstruction": {
      "extension": [
        {
          "url": "http://hl7.org/fhir/StructureDefinition/translation",
          "extension": [
            { "url": "lang", "valueCode": "hi-IN" },
            { "url": "content", "valueString": "नाश्ता करने के 15 मिनट बाद Metformin 500 mg की 1 टैबलेट लें। दिन में एक बार, 90 दिनों तक।" }
          ]
        },
        {
          "url": "http://hl7.org/fhir/StructureDefinition/translation",
          "extension": [
            { "url": "lang", "valueCode": "te-IN" },
            { "url": "content", "valueString": "ఉదయం టిఫిన్ చేసిన 15 నిమిషాల తర్వాత Metformin 500 mg 1 టాబ్లెట్ తీసుకోండి. రోజుకు ఒకసారి, 90 రోజుల పాటు." }
          ]
        }
      ]
    },
    "timing": {
      "repeat": {
        "boundsPeriod": { "start": "2026-07-09", "end": "2026-10-06" },
        "frequency": 1,
        "period": 1,
        "periodUnit": "d",
        "when": ["PCM"],
        "offset": 15
      }
    },
    "route": { "text": "Oral" },
    "doseAndRate": [{ "doseQuantity": { "value": 1, "unit": "tablet" } }]
  }]
}
```

### 5.2 The day-85 HbA1c result

```json
{
  "resourceType": "Observation",
  "id": "0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a12",
  "meta": {
    "source": "urn:healthguard:source:LAB_FEED",
    "tag": [{ "system": "urn:healthguard:tags", "code": "SYNTHETIC", "display": "DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE" }]
  },
  "status": "final",
  "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory" }] }],
  "code": { "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood" }] },
  "subject": { "reference": "Patient/0199b6f0-3c1a-7b2e-9a10-5d2c4e6f8a02" },
  "effectiveDateTime": "2026-10-01T03:30:00Z",
  "valueQuantity": { "value": 6.8, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" },
  "interpretation": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": "H" }] }],
  "referenceRange": [{ "high": { "value": 5.6, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" } }]
}
```

## 6. Demo mapping versus future production integration

| Aspect | Phase 1 demo | Production (Phase 3+) |
|---|---|---|
| Direction | Export only | Export as an ABDM HIP; import as an HIU and from laboratory and hospital feeds |
| Shape | `Bundle` of type `collection` with base R4 resources | ABDM `DocumentBundle` with a Composition per record type |
| Profiles | Base FHIR R4 | NRCeS FHIR Implementation Guide for ABDM, v6.5.0 |
| Terminology | LOINC and ICD-10 where seeded; marked local codes elsewhere | SNOMED CT, LOINC and ICD-10 per the guide's bindings |
| Identifiers | UUIDs and MRN | Plus ABHA, HPR and HFR identifiers |
| Validation | Structural tests in CI against the official FHIR R4 JSON Schema, in the existing Node toolchain | The HL7 FHIR Validator with the guide's package (adds a Java step to CI from Phase 2); conformance tests per record type |
| Transport and security | Authenticated download; `EXPORT` audit; synthetic tag | ABDM consent artefact checks and encrypted exchange ([ABDM integration §5](ABDM_INTEGRATION.md#5-health-information-exchange-boundary)) |
| Storage | No FHIR server | Optional FHIR store (HAPI FHIR, or AWS HealthLake, available in the Mumbai region since 2023) |
| Imported data | None | Lands as `INTEROP_IMPORT`, unverified, with provenance; not used in AI context until verified |

## 7. References

- [FHIR Implementation Guide for ABDM (NRCeS)](https://nrces.in/ndhm/fhir/r4/index.html)
- [FHIR R4 Timing datatype](https://hl7.org/fhir/R4/datatypes.html) and [EventTiming codes](https://hl7.org/fhir/R4/valueset-event-timing.html)
- [FHIR R4 vital signs profiles](https://hl7.org/fhir/R4/observation-vitalsigns.html)
- LOINC [4548-4](https://loinc.org/4548-4), [41950-7](https://loinc.org/41950-7), [93832-4](https://loinc.org/93832-4)
- [Amazon HealthLake in Asia Pacific (Mumbai)](https://aws.amazon.com/about-aws/whats-new/2023/04/amazon-healthlake-asia-pacific-mumbai-region)
