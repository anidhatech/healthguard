/**
 * FHIR R4 export, following docs/FHIR_MAPPING.md. Builds a `collection`
 * Bundle from rows the caller is allowed to see. Every resource is tagged
 * SYNTHETIC in the demo. It is a standards-shaped export, not a validated
 * ABDM health-information bundle.
 */
import { DEMO_DATA_NOTICE, type DataCategory } from '@healthguard/shared';
import { strength } from '../../common/mapping.js';
import type { DbClient } from '../../infrastructure/prisma/create-client.js';

type Resource = Record<string, unknown> & { resourceType: string; id: string };

/** A reserved, never-resolving base so relative references resolve inside the Bundle. */
export const FHIR_BASE = 'https://fhir.healthguard.invalid';
const LOCAL = (name: string) => `urn:healthguard:code:${name}`;
const UCUM = 'http://unitsofmeasure.org';
const LOINC = 'http://loinc.org';

const VITAL_CODES: Record<string, { code: string | null; display: string; ucum: string }> = {
  BLOOD_PRESSURE: { code: '85354-9', display: 'Blood pressure panel', ucum: 'mm[Hg]' },
  BODY_WEIGHT: { code: '29463-7', display: 'Body weight', ucum: 'kg' },
  HEART_RATE: { code: '8867-4', display: 'Heart rate', ucum: '/min' },
  BODY_HEIGHT: { code: '8302-2', display: 'Body height', ucum: 'cm' },
  OXYGEN_SATURATION: { code: '2708-6', display: 'Oxygen saturation', ucum: '%' },
  BODY_TEMPERATURE: { code: '8310-5', display: 'Body temperature', ucum: 'Cel' },
  BLOOD_GLUCOSE: { code: null, display: 'Blood glucose', ucum: 'mg/dL' },
};

const ACTIVITY_CODES: Record<string, { code: string | null; display: string; ucum: string }> = {
  STEPS: { code: '41950-7', display: 'Number of steps in 24 hour Measured', ucum: '{steps}' },
  SLEEP_DURATION: { code: '93832-4', display: 'Sleep duration', ucum: 'h' },
  ACTIVE_MINUTES: { code: null, display: 'Active minutes', ucum: 'min' },
  RESTING_HEART_RATE: { code: null, display: 'Resting heart rate', ucum: '/min' },
  WORKOUT_MINUTES: { code: null, display: 'Workout minutes', ucum: 'min' },
};

const INTERPRETATION: Record<string, string> = {
  LOW: 'L',
  NORMAL: 'N',
  HIGH: 'H',
  CRITICAL_LOW: 'LL',
  CRITICAL_HIGH: 'HH',
};

const PLAN_STATUS: Record<string, string> = {
  ACTIVE: 'active',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  SUPERSEDED: 'stopped',
  ENTERED_IN_ERROR: 'entered-in-error',
};

const PERIOD_UNIT: Record<string, string> = { DAY: 'd', WEEK: 'wk', MONTH: 'mo' };

function meta(recordSource?: string | null) {
  return {
    tag: [{ system: 'urn:healthguard:tags', code: 'SYNTHETIC', display: DEMO_DATA_NOTICE }],
    ...(recordSource ? { source: `urn:healthguard:source:${recordSource}` } : {}),
  };
}

function codeable(system: string | null, code: string | null, display: string) {
  return code && system
    ? { coding: [{ system, code, display }], text: display }
    : { text: display };
}

function codeSystemUri(system: string | null | undefined): string | null {
  if (!system) return null;
  if (system === 'ICD-10') return 'http://hl7.org/fhir/sid/icd-10';
  if (system === 'SNOMED-CT' || system === 'SNOMED CT') return 'http://snomed.info/sct';
  return LOCAL(system.toLowerCase());
}

function quantity(value: number, unit: string, ucum: string) {
  return { value, unit, system: UCUM, code: ucum };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'collection';
  timestamp: string;
  meta: ReturnType<typeof meta>;
  entry: { fullUrl: string; resource: Resource }[];
}

/** Builds the Bundle. `allowed` lists the data categories the caller may see. */
export async function buildPatientBundle(
  db: DbClient,
  patientId: string,
  allowed: readonly DataCategory[],
  bundleId: string,
  now: Date,
): Promise<FhirBundle> {
  const can = (category: DataCategory) => allowed.includes(category);
  const patient = await db.patientProfile.findUniqueOrThrow({
    where: { id: patientId },
    include: { organization: true },
  });
  const where = { patientProfileId: patient.id, organizationId: patient.organizationId };
  const resources: Resource[] = [];
  const subject = { reference: `Patient/${patient.id}` };

  resources.push({
    resourceType: 'Organization',
    id: patient.organization.id,
    meta: meta(),
    name: patient.organization.name,
    identifier: [{ system: 'urn:healthguard:organization', value: patient.organization.slug }],
  });
  resources.push({
    resourceType: 'Patient',
    id: patient.id,
    meta: meta(),
    identifier: [
      { system: `urn:healthguard:${patient.organization.slug}:mrn`, value: patient.mrn },
    ],
    active: patient.status === 'ACTIVE',
    name: [
      { given: [patient.givenName], ...(patient.familyName ? { family: patient.familyName } : {}) },
    ],
    gender: patient.sex.toLowerCase(),
    birthDate: dateOnly(patient.dateOfBirth),
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: patient.preferredLocale }] },
        preferred: true,
      },
    ],
    managingOrganization: { reference: `Organization/${patient.organization.id}` },
    ...(patient.primaryClinicianId
      ? { generalPractitioner: [{ reference: `PractitionerRole/${patient.primaryClinicianId}` }] }
      : {}),
  });

  const clinicians = new Map<string, string>();
  const practitionerRef = (id: string | null, name?: string) => {
    if (!id) return undefined;
    if (name) clinicians.set(id, name);
    return { reference: `PractitionerRole/${id}` };
  };

  if (can('ENCOUNTERS')) {
    const encounters = await db.encounter.findMany({ where, include: { clinician: true } });
    for (const row of encounters) {
      resources.push({
        resourceType: 'Encounter',
        id: row.id,
        meta: meta(row.recordSource),
        status:
          row.recordStatus === 'ENTERED_IN_ERROR'
            ? 'entered-in-error'
            : ({
                PLANNED: 'planned',
                IN_PROGRESS: 'in-progress',
                COMPLETED: 'finished',
                CANCELLED: 'cancelled',
              }[row.status] ?? 'unknown'),
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: row.type === 'TELECONSULT' ? 'VR' : row.type === 'INPATIENT' ? 'IMP' : 'AMB',
        },
        subject,
        participant: [{ individual: practitionerRef(row.clinicianId, row.clinician.displayName) }],
        ...(row.startedAt
          ? {
              period: {
                start: row.startedAt.toISOString(),
                ...(row.endedAt ? { end: row.endedAt.toISOString() } : {}),
              },
            }
          : {}),
        ...(row.reasonForVisit ? { reasonCode: [{ text: row.reasonForVisit }] } : {}),
        ...(row.appointmentId
          ? { appointment: [{ reference: `Appointment/${row.appointmentId}` }] }
          : {}),
        serviceProvider: { reference: `Organization/${patient.organizationId}` },
      });
    }
  }

  if (can('CONDITIONS')) {
    for (const row of await db.condition.findMany({ where })) {
      resources.push({
        resourceType: 'Condition',
        id: row.id,
        meta: meta(row.recordSource),
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: row.clinicalStatus.toLowerCase(),
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code:
                row.recordStatus === 'ENTERED_IN_ERROR'
                  ? 'entered-in-error'
                  : row.clinicalVerification.toLowerCase(),
            },
          ],
        },
        code: codeable(codeSystemUri(row.codeSystem), row.code, row.display),
        subject,
        ...(row.encounterId ? { encounter: { reference: `Encounter/${row.encounterId}` } } : {}),
        ...(row.onsetDate ? { onsetDateTime: dateOnly(row.onsetDate) } : {}),
      });
    }
  }

  if (can('ALLERGIES')) {
    for (const row of await db.allergy.findMany({ where })) {
      resources.push({
        resourceType: 'AllergyIntolerance',
        id: row.id,
        meta: meta(row.recordSource),
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: row.clinicalStatus.toLowerCase(),
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
              code:
                row.recordStatus === 'ENTERED_IN_ERROR'
                  ? 'entered-in-error'
                  : row.clinicalVerification === 'CONFIRMED'
                    ? 'confirmed'
                    : row.clinicalVerification === 'REFUTED'
                      ? 'refuted'
                      : 'unconfirmed',
            },
          ],
        },
        type: row.type.toLowerCase(),
        category: [row.category.toLowerCase()],
        ...(row.criticality
          ? { criticality: row.criticality.toLowerCase().replace('_', '-') }
          : {}),
        code: { text: row.substance },
        patient: subject,
        ...(row.onsetDate ? { onsetDateTime: dateOnly(row.onsetDate) } : {}),
        recordedDate: row.createdAt.toISOString(),
        ...(row.reaction
          ? {
              reaction: [
                {
                  manifestation: [{ text: row.reaction }],
                  ...(row.severity ? { severity: row.severity.toLowerCase() } : {}),
                },
              ],
            }
          : {}),
      });
    }
  }

  if (can('MEDICATIONS')) {
    const plans = await db.medicationPlan.findMany({
      where: { ...where, status: { not: 'DRAFT' } },
      include: {
        medication: true,
        prescriber: true,
        instructions: { where: { status: 'APPROVED' } },
      },
    });
    for (const row of plans) {
      const english = row.instructions.find((i) => i.locale === 'en-IN');
      const translations = row.instructions
        .filter((i) => i.locale !== 'en-IN')
        .map((i) => ({
          url: 'http://hl7.org/fhir/StructureDefinition/translation',
          extension: [
            { url: 'lang', valueCode: i.locale },
            { url: 'content', valueString: i.doseText },
          ],
        }));
      const end = row.durationDays
        ? new Date(row.startDate.getTime() + (row.durationDays - 1) * 86_400_000)
        : null;
      const medicationText = `${row.medication.genericName} ${strength(row.medication)}`;
      const dosage = {
        text: `${Number(row.doseQuantity)} ${row.doseUnit.toLowerCase()} ${row.route.toLowerCase()}, ${row.frequency} time(s) every ${row.period} ${row.periodUnit.toLowerCase()}, ${row.timingEvents.join('/')}${row.timingOffsetMinutes ? ` +${row.timingOffsetMinutes} min` : ''}${row.durationDays ? `, for ${row.durationDays} days` : ''}`,
        ...(english
          ? {
              patientInstruction: english.doseText,
              ...(translations.length ? { _patientInstruction: { extension: translations } } : {}),
            }
          : {}),
        ...(row.specialInstructions
          ? { additionalInstruction: [{ text: row.specialInstructions }] }
          : {}),
        timing: {
          repeat: {
            frequency: row.frequency,
            period: row.period,
            periodUnit: PERIOD_UNIT[row.periodUnit],
            ...(row.timingEvents.length ? { when: row.timingEvents } : {}),
            ...(row.timingOffsetMinutes ? { offset: row.timingOffsetMinutes } : {}),
            ...(row.timesOfDay.length ? { timeOfDay: row.timesOfDay.map((t) => `${t}:00`) } : {}),
            boundsPeriod: {
              start: dateOnly(row.startDate),
              ...(end ? { end: dateOnly(end) } : {}),
            },
          },
        },
        route: { text: row.route.toLowerCase() },
        asNeededBoolean: row.asNeeded,
        doseAndRate: [
          { doseQuantity: { value: Number(row.doseQuantity), unit: row.doseUnit.toLowerCase() } },
        ],
      };
      const medicationCodeableConcept = {
        coding: [{ system: LOCAL('medication'), code: row.medication.id, display: medicationText }],
        text: medicationText,
      };
      if (row.recordSource === 'PATIENT_REPORTED') {
        resources.push({
          resourceType: 'MedicationStatement',
          id: row.id,
          meta: meta(row.recordSource),
          status: PLAN_STATUS[row.status] ?? 'unknown',
          medicationCodeableConcept,
          subject,
          effectivePeriod: {
            start: dateOnly(row.startDate),
            ...(row.endDate ? { end: dateOnly(row.endDate) } : {}),
          },
          dateAsserted: row.createdAt.toISOString(),
          informationSource: subject,
          dosage: [dosage],
        });
        continue;
      }
      resources.push({
        resourceType: 'MedicationRequest',
        id: row.id,
        meta: meta(row.recordSource),
        status: PLAN_STATUS[row.status] ?? 'unknown',
        ...(row.status === 'SUPERSEDED' ? { statusReason: { text: 'superseded' } } : {}),
        intent: 'order',
        medicationCodeableConcept,
        subject,
        ...(row.encounterId ? { encounter: { reference: `Encounter/${row.encounterId}` } } : {}),
        ...(row.signedAt ? { authoredOn: row.signedAt.toISOString() } : {}),
        ...(row.prescriberId
          ? { requester: practitionerRef(row.prescriberId, row.prescriber?.displayName) }
          : {}),
        ...(row.indication ? { reasonCode: [{ text: row.indication }] } : {}),
        ...(row.supersedesId
          ? { priorPrescription: { reference: `MedicationRequest/${row.supersedesId}` } }
          : {}),
        dosageInstruction: [dosage],
      });
    }
  }

  if (can('LABS')) {
    const labs = await db.labResult.findMany({ where, include: { labTest: true, document: true } });
    const byDocument = new Map<string, { title: string; ids: string[]; effective: Date[] }>();
    for (const row of labs) {
      const unit = row.unit;
      resources.push({
        resourceType: 'Observation',
        id: row.id,
        meta: meta(row.recordSource),
        status:
          row.recordStatus === 'ENTERED_IN_ERROR' ? 'entered-in-error' : row.status.toLowerCase(),
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
              },
            ],
          },
        ],
        code: codeable(
          row.labTest.loincCode ? LOINC : LOCAL('lab'),
          row.labTest.loincCode ?? row.labTest.code,
          row.labTest.name,
        ),
        subject,
        effectiveDateTime: row.effectiveAt.toISOString(),
        ...(row.issuedAt ? { issued: row.issuedAt.toISOString() } : {}),
        ...(row.valueNumeric !== null
          ? { valueQuantity: quantity(Number(row.valueNumeric), unit, unit === '%' ? '%' : unit) }
          : row.valueText
            ? { valueString: row.valueText }
            : {}),
        ...(row.interpretation
          ? {
              interpretation: [
                {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                      code: INTERPRETATION[row.interpretation],
                    },
                  ],
                },
              ],
            }
          : {}),
        ...(row.referenceLow !== null || row.referenceHigh !== null
          ? {
              referenceRange: [
                {
                  ...(row.referenceLow !== null
                    ? { low: { value: Number(row.referenceLow), unit } }
                    : {}),
                  ...(row.referenceHigh !== null
                    ? { high: { value: Number(row.referenceHigh), unit } }
                    : {}),
                },
              ],
            }
          : {}),
        ...(row.performingLab ? { performer: [{ display: row.performingLab }] } : {}),
        ...(row.encounterId ? { encounter: { reference: `Encounter/${row.encounterId}` } } : {}),
        ...(row.recordSource === 'DOCUMENT_EXTRACTION'
          ? {
              note: [
                {
                  text: `Read from an uploaded report; ${row.verification === 'UNVERIFIED' ? 'not yet confirmed by the patient' : 'confirmed by the patient'}.`,
                },
              ],
            }
          : {}),
      });
      if (row.documentId && row.document) {
        const group = byDocument.get(row.documentId) ?? {
          title: row.document.title,
          ids: [],
          effective: [],
        };
        group.ids.push(row.id);
        group.effective.push(row.effectiveAt);
        byDocument.set(row.documentId, group);
      }
    }
    for (const [documentId, group] of byDocument) {
      resources.push({
        resourceType: 'DiagnosticReport',
        id: documentId,
        meta: meta('DOCUMENT_EXTRACTION'),
        status: 'final',
        category: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }] },
        ],
        code: { text: group.title },
        subject,
        effectiveDateTime: new Date(
          Math.min(...group.effective.map((d) => d.getTime())),
        ).toISOString(),
        result: group.ids.map((id) => ({ reference: `Observation/${id}` })),
      });
    }
  }

  if (can('VITALS')) {
    for (const row of await db.vital.findMany({ where })) {
      const code = VITAL_CODES[row.type] ?? { code: null, display: row.type, ucum: row.unit };
      const base = {
        resourceType: 'Observation',
        id: row.id,
        meta: meta(row.recordSource),
        status: row.recordStatus === 'ENTERED_IN_ERROR' ? 'entered-in-error' : 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              },
            ],
          },
        ],
        code: codeable(code.code ? LOINC : LOCAL('vital'), code.code ?? row.type, code.display),
        subject,
        effectiveDateTime: row.measuredAt.toISOString(),
        ...(row.context ? { note: [{ text: row.context }] } : {}),
      };
      if (row.type === 'BLOOD_PRESSURE') {
        resources.push({
          ...base,
          component: [
            {
              code: codeable(LOINC, '8480-6', 'Systolic blood pressure'),
              valueQuantity: quantity(Number(row.value), 'mmHg', 'mm[Hg]'),
            },
            ...(row.value2 !== null
              ? [
                  {
                    code: codeable(LOINC, '8462-4', 'Diastolic blood pressure'),
                    valueQuantity: quantity(Number(row.value2), 'mmHg', 'mm[Hg]'),
                  },
                ]
              : []),
          ],
        });
      } else {
        resources.push({
          ...base,
          valueQuantity: quantity(Number(row.value), row.unit, code.ucum),
        });
      }
    }
  }

  if (can('ACTIVITY')) {
    for (const row of await db.activityMetric.findMany({ where })) {
      const code = ACTIVITY_CODES[row.type] ?? { code: null, display: row.type, ucum: row.unit };
      const date = dateOnly(row.date);
      resources.push({
        resourceType: 'Observation',
        id: row.id,
        meta: {
          ...meta(row.recordSource),
          source: `urn:healthguard:source:${row.recordSource}:${row.sourceSystem}`,
        },
        status: row.recordStatus === 'ENTERED_IN_ERROR' ? 'entered-in-error' : 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'activity',
              },
            ],
          },
        ],
        code: codeable(code.code ? LOINC : LOCAL('activity'), code.code ?? row.type, code.display),
        subject,
        effectivePeriod: { start: `${date}T00:00:00+05:30`, end: `${date}T23:59:59+05:30` },
        valueQuantity: quantity(Number(row.value), row.unit, code.ucum),
        device: { display: row.sourceSystem },
      });
    }
  }

  if (can('HISTORY')) {
    for (const row of await db.immunization.findMany({ where })) {
      resources.push({
        resourceType: 'Immunization',
        id: row.id,
        meta: meta(row.recordSource),
        status:
          row.recordStatus === 'ENTERED_IN_ERROR'
            ? 'entered-in-error'
            : row.status === 'NOT_DONE'
              ? 'not-done'
              : 'completed',
        vaccineCode: codeable(
          row.vaccineCode ? LOCAL('vaccine') : null,
          row.vaccineCode,
          row.vaccineName,
        ),
        patient: subject,
        occurrenceDateTime: dateOnly(row.occurredOn),
        ...(row.doseNumber ? { protocolApplied: [{ doseNumberPositiveInt: row.doseNumber }] } : {}),
      });
    }
    for (const row of await db.procedure.findMany({ where })) {
      resources.push({
        resourceType: 'Procedure',
        id: row.id,
        meta: meta(row.recordSource),
        status:
          row.recordStatus === 'ENTERED_IN_ERROR'
            ? 'entered-in-error'
            : row.status === 'NOT_DONE'
              ? 'not-done'
              : 'completed',
        code: codeable(codeSystemUri(row.codeSystem), row.code, row.display),
        subject,
        ...(row.performedOn ? { performedDateTime: dateOnly(row.performedOn) } : {}),
        ...(row.performerText ? { performer: [{ actor: { display: row.performerText } }] } : {}),
      });
    }
  }

  if (can('APPOINTMENTS')) {
    const appointments = await db.appointment.findMany({ where, include: { clinician: true } });
    for (const row of appointments) {
      resources.push({
        resourceType: 'Appointment',
        id: row.id,
        meta: meta(),
        status: {
          PROPOSED: 'proposed',
          PATIENT_APPROVED: 'pending',
          CONFIRMED: 'booked',
          CANCELLED: 'cancelled',
          COMPLETED: 'fulfilled',
          NO_SHOW: 'noshow',
        }[row.status],
        ...(row.reason ? { description: row.reason } : {}),
        start: row.startAt.toISOString(),
        end: row.endAt.toISOString(),
        participant: [
          { actor: subject, status: row.patientApprovedAt ? 'accepted' : 'needs-action' },
          {
            actor: practitionerRef(row.clinicianId, row.clinician.displayName),
            status: 'accepted',
          },
        ],
      });
    }
  }

  for (const [id, name] of clinicians) {
    resources.push({
      resourceType: 'PractitionerRole',
      id,
      meta: meta(),
      practitioner: { display: name },
      organization: { reference: `Organization/${patient.organizationId}` },
    });
  }

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    timestamp: now.toISOString(),
    meta: meta(),
    entry: resources.map((resource) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}
