import type { DoseStatus, Prisma } from '../../../generated/prisma/client.js';
import {
  insertAuditEvents,
  insertConsent,
  insertDailyDoses,
  insertPlan,
  SYNTHETIC,
  type SeedAuditEvent,
  type SeedDb,
} from './helpers.js';
import { CLINICIAN, MEMBER, ORG, PATIENT, ROUTINES, USER } from './people.js';
import { LAB_TESTS, labTestId } from './reference-data.js';
import { at, calendarAt, dayDate, prng, seedId, windowWithMean } from './scenario.js';

/** Hero numbers the seed guarantees on day 92 (asserted after seeding). */
export const HERO = {
  hba1cBefore: 7.4,
  hba1cAfter: 6.8,
  weightBefore: 74.2,
  weightAfter: 72.9,
  stepsBefore: 5200,
  stepsAfter: 7100,
  adherencePercent: 92,
  dosesTaken: 166,
  dosesDue: 180,
  // Two misses in a row on days 40–41 raise the flag seen at the day-42 checkpoint.
  missedDays: [17, 40, 41, 63, 77],
  skippedDays: [28, 70],
};

export const ANANYA = {
  encounterPrevious: seedId('encounter:ananya:-182'),
  encounterDay0: seedId('encounter:ananya:0'),
  appointmentDay0: seedId('appointment:ananya:0'),
  appointmentDay92: seedId('appointment:ananya:92'),
  carePlan: seedId('care-plan:ananya'),
  planMetformin: seedId('plan:ananya-metformin'),
  planTelmisartan: seedId('plan:ananya-telmisartan'),
  documentDay85: seedId('document:ananya:lab-85'),
  followUpHba1c: seedId('follow-up:ananya:hba1c'),
  followUpVisit: seedId('follow-up:ananya:visit'),
};

const org = ORG.hdmc;
const patientId = PATIENT.ananya;

function doseOutcome(day: number): DoseStatus {
  if (HERO.missedDays.includes(day)) return 'MISSED';
  if (HERO.skippedDays.includes(day)) return 'SKIPPED';
  return 'TAKEN';
}

/**
 * Ananya's story as it stood on the morning of scenario day `until`
 * (checkpoints 0, 6, 42, 85, 88, 92). Nothing dated after that moment is
 * created, and statuses are the ones in force then. Today's doses are not
 * seeded: the dose scheduler creates them so they can be answered live.
 */
export async function seedAnanya(db: SeedDb, until: number): Promise<void> {
  const by = (day: number) => day <= until;
  const lastDoseDay = Math.min(90, until - 1);

  // Visits ---------------------------------------------------------------
  const appointments: Prisma.AppointmentCreateManyInput[] = [
    {
      id: ANANYA.appointmentDay0,
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.meera,
      mode: 'IN_PERSON',
      status: until === 0 ? 'CONFIRMED' : 'COMPLETED',
      startAt: at(0, '10:30'),
      endAt: at(0, '10:50'),
      reason: 'Diabetes and blood pressure review',
      proposedAt: at(-14, '12:00'),
      patientApprovedAt: at(-13, '19:10'),
      patientApprovedByUserId: USER.ananya,
      confirmedAt: at(-13, '19:30'),
      confirmedByUserId: USER.ravi,
    },
  ];
  if (by(88)) {
    const proposedOnly = until === 88;
    appointments.push({
      id: ANANYA.appointmentDay92,
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.meera,
      followUpId: ANANYA.followUpVisit,
      mode: 'IN_PERSON',
      status: proposedOnly ? 'PROPOSED' : 'CONFIRMED',
      startAt: at(92, '10:30'),
      endAt: at(92, '10:50'),
      reason: '3-month follow-up: HbA1c review',
      proposedAt: at(88, '09:30'),
      patientApprovedAt: proposedOnly ? null : at(88, '20:05'),
      patientApprovedByUserId: proposedOnly ? null : USER.ananya,
      confirmedAt: proposedOnly ? null : at(89, '09:15'),
      confirmedByUserId: proposedOnly ? null : USER.ravi,
    });
  }
  // Follow-ups first: the day-92 appointment refers to the visit follow-up.
  await db.encounter.createMany({
    data: [
      {
        id: ANANYA.encounterPrevious,
        organizationId: org,
        patientProfileId: patientId,
        clinicianId: CLINICIAN.meera,
        type: 'OUTPATIENT',
        status: 'COMPLETED',
        reasonForVisit: 'Blood pressure review',
        clinicalNotes: 'Synthetic note. BP reviewed; continue current plan.',
        startedAt: at(-182, '11:00'),
        endedAt: at(-182, '11:20'),
        recordedByUserId: USER.meera,
        ...SYNTHETIC,
      },
    ],
  });

  // History --------------------------------------------------------------
  await db.condition.createMany({
    data: [
      {
        id: seedId('condition:ananya:t2dm'),
        organizationId: org,
        patientProfileId: patientId,
        codeSystem: 'ICD-10',
        code: 'E11',
        display: 'Type 2 diabetes mellitus',
        onsetDate: calendarAt('2024-02-10'),
        verification: 'CLINICIAN_VERIFIED',
        recordedByUserId: USER.meera,
        ...SYNTHETIC,
      },
      {
        id: seedId('condition:ananya:htn'),
        organizationId: org,
        patientProfileId: patientId,
        codeSystem: 'ICD-10',
        code: 'I10',
        display: 'Essential (primary) hypertension',
        onsetDate: calendarAt('2021-06-01'),
        verification: 'CLINICIAN_VERIFIED',
        recordedByUserId: USER.meera,
        ...SYNTHETIC,
      },
    ],
  });
  await db.allergy.create({
    data: {
      id: seedId('allergy:ananya:penicillin'),
      organizationId: org,
      patientProfileId: patientId,
      substance: 'Penicillin',
      allergenClass: 'PENICILLIN',
      category: 'MEDICATION',
      criticality: 'HIGH',
      reaction: 'Hives and itching',
      severity: 'MODERATE',
      onsetDate: calendarAt('1998-05-01'),
      verification: 'CLINICIAN_VERIFIED',
      ...SYNTHETIC,
    },
  });
  await db.procedure.create({
    data: {
      id: seedId('procedure:ananya:chole'),
      organizationId: org,
      patientProfileId: patientId,
      display: 'Laparoscopic cholecystectomy',
      code: '45595009',
      codeSystem: 'SNOMED-CT',
      performedOn: calendarAt('2019-11-20'),
      facilityText: 'Synthetic City Hospital',
      outcome: 'Uneventful recovery',
      verification: 'PATIENT_CONFIRMED',
      ...SYNTHETIC,
    },
  });
  await db.immunization.createMany({
    data: [
      {
        id: seedId('immunization:ananya:covid'),
        organizationId: org,
        patientProfileId: patientId,
        vaccineName: 'COVID-19 vaccine (booster)',
        occurredOn: calendarAt('2022-04-12'),
        doseNumber: 3,
        verification: 'PATIENT_CONFIRMED',
        ...SYNTHETIC,
      },
      {
        id: seedId('immunization:ananya:flu'),
        organizationId: org,
        patientProfileId: patientId,
        vaccineName: 'Influenza vaccine',
        occurredOn: calendarAt('2025-10-15'),
        doseNumber: 1,
        verification: 'PATIENT_CONFIRMED',
        ...SYNTHETIC,
      },
    ],
  });

  // Day 0 visit: in progress at checkpoint 0 (the presenter prescribes live).
  await db.appointment.createMany({
    data: appointments.filter((row) => row.id === ANANYA.appointmentDay0),
  });
  await db.encounter.create({
    data: {
      id: ANANYA.encounterDay0,
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.meera,
      appointmentId: ANANYA.appointmentDay0,
      type: 'OUTPATIENT',
      status: until === 0 ? 'IN_PROGRESS' : 'COMPLETED',
      reasonForVisit: 'Diabetes and blood pressure review',
      clinicalNotes: 'Synthetic note. HbA1c above target; plan discussed with patient.',
      startedAt: at(0, '10:32'),
      endedAt: until === 0 ? null : at(0, '10:52'),
      recordedByUserId: USER.meera,
      ...SYNTHETIC,
    },
  });

  // Care plan and follow-ups (written at the end of the day-0 visit) -----
  if (by(1)) {
    await db.carePlan.create({
      data: {
        id: ANANYA.carePlan,
        organizationId: org,
        patientProfileId: patientId,
        encounterId: ANANYA.encounterDay0,
        authorId: CLINICIAN.meera,
        title: 'Diabetes and blood pressure care plan',
        goals: [
          'Take medicines as prescribed',
          'Walk at least 30 minutes most days',
          'Repeat HbA1c in about 3 months',
          'Home blood pressure once a week',
        ],
        status: 'ACTIVE',
        startDate: dayDate(0),
      },
    });
    const followUps: Prisma.FollowUpCreateManyInput[] = [
      {
        id: ANANYA.followUpHba1c,
        organizationId: org,
        patientProfileId: patientId,
        carePlanId: ANANYA.carePlan,
        labTestId: labTestId('HBA1C'),
        type: 'REPEAT_TEST',
        origin: 'CLINICIAN',
        reason: 'Repeat HbA1c before the 3-month review',
        dueDate: dayDate(85),
        windowStart: dayDate(80),
        windowEnd: dayDate(90),
        status: by(85) ? 'COMPLETED' : by(80) ? 'DUE' : 'PLANNED',
        createdByUserId: USER.meera,
        completedAt: by(85) ? at(85, '09:00') : null,
      },
      {
        id: ANANYA.followUpVisit,
        organizationId: org,
        patientProfileId: patientId,
        carePlanId: ANANYA.carePlan,
        type: 'VISIT',
        origin: 'CLINICIAN',
        reason: '3-month review with Dr. Meera Sharma',
        dueDate: dayDate(92),
        windowStart: dayDate(88),
        windowEnd: dayDate(96),
        status: until > 88 ? 'SCHEDULED' : until === 88 ? 'PROPOSED' : 'PLANNED',
        createdByUserId: USER.meera,
      },
    ];
    if (by(7)) {
      followUps.push({
        id: seedId('follow-up:ananya:help-6'),
        organizationId: org,
        patientProfileId: patientId,
        carePlanId: ANANYA.carePlan,
        assignedMemberId: MEMBER.ravi,
        type: 'CALLBACK',
        origin: 'PATIENT_REQUEST',
        reason: 'Need help: "My stomach is upset after the new tablet. Should I keep taking it?"',
        dueDate: dayDate(6),
        status: 'COMPLETED',
        completedAt: at(6, '15:20'),
      });
    }
    if (by(42)) {
      followUps.push({
        id: seedId('follow-up:ananya:callback'),
        organizationId: org,
        patientProfileId: patientId,
        carePlanId: ANANYA.carePlan,
        assignedMemberId: MEMBER.ravi,
        type: 'CALLBACK',
        origin: 'RULE',
        reason: 'Two doses in a row were not confirmed; check in with the patient',
        dueDate: dayDate(42),
        status: by(43) ? 'COMPLETED' : 'DUE',
        completedAt: by(43) ? at(43, '16:10') : null,
      });
    }
    await db.followUp.createMany({ data: followUps });
  }
  await db.appointment.createMany({
    data: appointments.filter((row) => row.id !== ANANYA.appointmentDay0),
  });

  // Medicines and doses (synthetic, not a prescription) -----------------
  const telmisartan = await insertPlan(db, {
    key: 'ananya-telmisartan',
    organizationId: org,
    patientId,
    prescriberId: CLINICIAN.meera,
    encounterId: ANANYA.encounterPrevious,
    medication: 'telmisartan40',
    timing: 'MORN',
    offsetMinutes: null,
    durationDays: null,
    startDay: -181,
    status: 'ACTIVE',
    indication: 'Blood pressure',
    approvedByUserId: USER.meera,
  });
  // Metformin is prescribed at the day-0 visit; at checkpoint 0 the presenter does it live.
  const metformin = by(1)
    ? await insertPlan(db, {
        key: 'ananya-metformin',
        organizationId: org,
        patientId,
        prescriberId: CLINICIAN.meera,
        encounterId: ANANYA.encounterDay0,
        medication: 'metformin500',
        timing: 'PCM',
        offsetMinutes: 15,
        durationDays: 90,
        startDay: 1,
        status: until > 90 ? 'COMPLETED' : 'ACTIVE',
        indication: 'Blood sugar',
        approvedByUserId: USER.meera,
      })
    : null;
  if (lastDoseDay >= 1) {
    const plans = [['ananya-telmisartan', telmisartan, 'MORN', null, 11] as const];
    const all = metformin
      ? [...plans, ['ananya-metformin', metformin, 'PCM', 15, 12] as const]
      : plans;
    for (const [planKey, planId, timing, offset, seed] of all) {
      await insertDailyDoses(db, {
        planKey,
        planId,
        organizationId: org,
        patientId,
        patientUserId: USER.ananya,
        routine: ROUTINES.ananya,
        timing,
        offsetMinutes: offset,
        startDay: 1,
        days: lastDoseDay,
        outcome: doseOutcome,
        seed,
      });
    }
  }

  // Labs ------------------------------------------------------------------
  // The day-85 report arrives as a document; its values are extracted and the
  // patient confirms them. Until confirmed they are not used in calculations.
  const extractedPending = until === 85;
  const lab = (
    key: string,
    code: keyof typeof LAB_TESTS,
    day: number,
    value: number,
    interpretation: 'NORMAL' | 'HIGH',
    encounterId?: string,
  ): Prisma.LabResultCreateManyInput => ({
    id: seedId(`lab:ananya:${key}`),
    organizationId: org,
    patientProfileId: patientId,
    labTestId: labTestId(code),
    encounterId: encounterId ?? null,
    valueNumeric: value,
    unit: LAB_TESTS[code].unit,
    referenceLow: LAB_TESTS[code].referenceLow,
    referenceHigh: LAB_TESTS[code].referenceHigh,
    interpretation,
    effectiveAt: at(day, '08:30'),
    issuedAt: at(day, day === 85 ? '07:30' : '17:00'),
    performingLab: 'Synthetic Diagnostics Lab',
    verification: 'CLINICIAN_VERIFIED',
    ...SYNTHETIC,
  });
  const fromReport = (row: Prisma.LabResultCreateManyInput): Prisma.LabResultCreateManyInput => ({
    ...row,
    documentId: ANANYA.documentDay85,
    recordSource: 'DOCUMENT_EXTRACTION',
    sourceSystem: 'demo-sample-report-extraction',
    extractionConfidence: 0.97,
    status: extractedPending ? 'PRELIMINARY' : 'FINAL',
    verification: extractedPending ? 'UNVERIFIED' : 'PATIENT_CONFIRMED',
    issuedAt: at(84, '17:00'),
    effectiveAt: at(84, '08:30'),
  });
  if (by(85)) {
    await db.document.create({
      data: {
        id: ANANYA.documentDay85,
        organizationId: org,
        patientProfileId: patientId,
        type: 'LAB_REPORT',
        title: 'HbA1c and fasting glucose report (synthetic sample)',
        documentDate: dayDate(84),
        objectKey: 'demo/ananya/lab-report-day84.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 48_213,
        sha256: 'demo-sample-not-a-real-file',
        status: extractedPending ? 'EXTRACTED' : 'VERIFIED',
        isSyntheticSample: true,
        ...SYNTHETIC,
      },
    });
  }
  const labs: Prisma.LabResultCreateManyInput[] = [
    lab('hba1c:-182', 'HBA1C', -182, 7.1, 'HIGH', ANANYA.encounterPrevious),
    lab('hba1c:0', 'HBA1C', 0, HERO.hba1cBefore, 'HIGH', ANANYA.encounterDay0),
    lab('fpg:0', 'FASTING_GLUCOSE', 0, 148, 'HIGH', ANANYA.encounterDay0),
    lab('creatinine:0', 'CREATININE', 0, 0.8, 'NORMAL', ANANYA.encounterDay0),
  ];
  if (by(85)) {
    labs.push(
      {
        ...fromReport(lab('hba1c:85', 'HBA1C', 84, HERO.hba1cAfter, 'HIGH')),
        followUpId: ANANYA.followUpHba1c,
      },
      fromReport(lab('fpg:85', 'FASTING_GLUCOSE', 84, 126, 'HIGH')),
      fromReport(lab('creatinine:85', 'CREATININE', 84, 0.8, 'NORMAL')),
    );
  }
  await db.labResult.createMany({ data: labs });

  // Vitals: weekly weight 74.2 → 72.9 kg, blood pressure at visits and home.
  const random = prng(21);
  const vitals: Prisma.VitalCreateManyInput[] = [];
  const weeks = 14; // days 0, 7, …, 91
  for (let week = 0; week < weeks; week += 1) {
    const day = week * 7;
    const linear =
      HERO.weightBefore + ((HERO.weightAfter - HERO.weightBefore) * week) / (weeks - 1);
    const jitter = week === 0 || week === weeks - 1 ? 0 : (random() - 0.5) * 0.2;
    const systolic = Math.round(138 - (10 * week) / (weeks - 1) + (random() - 0.5) * 4);
    const diastolic = Math.round(86 - (6 * week) / (weeks - 1) + (random() - 0.5) * 3);
    if (!by(day)) continue;
    vitals.push(
      {
        id: seedId(`vital:ananya:weight:${day}`),
        organizationId: org,
        patientProfileId: patientId,
        type: 'BODY_WEIGHT',
        value: Math.round((linear + jitter) * 10) / 10,
        unit: 'kg',
        measuredAt: at(day, '07:10'),
        context: day === 0 ? 'Clinic' : 'Home scale',
        encounterId: day === 0 ? ANANYA.encounterDay0 : null,
        ...SYNTHETIC,
        verification: day === 0 ? 'CLINICIAN_VERIFIED' : 'UNVERIFIED',
      },
      {
        id: seedId(`vital:ananya:bp:${day}`),
        organizationId: org,
        patientProfileId: patientId,
        type: 'BLOOD_PRESSURE',
        value: systolic,
        value2: diastolic,
        unit: 'mmHg',
        measuredAt: at(day, '07:20'),
        context: day === 0 ? 'Clinic, seated' : 'Home, seated',
        encounterId: day === 0 ? ANANYA.encounterDay0 : null,
        ...SYNTHETIC,
        verification: day === 0 ? 'CLINICIAN_VERIFIED' : 'UNVERIFIED',
      },
    );
  }
  vitals.push({
    id: seedId('vital:ananya:height'),
    organizationId: org,
    patientProfileId: patientId,
    type: 'BODY_HEIGHT',
    value: 158,
    unit: 'cm',
    measuredAt: at(0, '10:35'),
    encounterId: ANANYA.encounterDay0,
    ...SYNTHETIC,
    verification: 'CLINICIAN_VERIFIED',
  });
  await db.vital.createMany({ data: vitals });

  // Steps (daily totals up to yesterday): the 30 days before day 0 average
  // exactly 5,200; days 62–91 exactly 7,100.
  const stepsRandom = prng(31);
  const before = windowWithMean(stepsRandom, 30, HERO.stepsBefore, 900);
  const after = windowWithMean(stepsRandom, 30, HERO.stepsAfter, 1100);
  const trend: number[] = [];
  for (let day = 0; day <= 61; day += 1) {
    const base = HERO.stepsBefore + ((HERO.stepsAfter - HERO.stepsBefore) * day) / 62;
    trend.push(Math.round(base + (stepsRandom() - 0.5) * 1600));
  }
  const steps: Prisma.ActivityMetricCreateManyInput[] = [];
  const pushSteps = (day: number, value: number) => {
    if (day >= until) return;
    steps.push({
      id: seedId(`activity:ananya:steps:${day}`),
      organizationId: org,
      patientProfileId: patientId,
      type: 'STEPS',
      date: dayDate(day),
      value,
      unit: 'steps',
      recordSource: 'SYNTHETIC_SEED',
      sourceSystem: 'demo-phone-pedometer',
    });
  };
  before.forEach((value, index) => pushSteps(-30 + index, value));
  trend.forEach((value, day) => pushSteps(day, value));
  after.forEach((value, index) => pushSteps(62 + index, value));
  if (steps.length) await db.activityMetric.createMany({ data: steps });

  // Consents (AI assistance and medication management granted at the day-0 visit).
  const allCategories = [
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
  const consentIds = [
    await insertConsent(db, {
      key: 'ananya:consultation',
      organizationId: org,
      patientId,
      purpose: 'CONSULTATION',
      categories: [...allCategories],
      grantedDay: -182,
      validDays: 365,
      locale: 'te-IN',
    }),
    await insertConsent(db, {
      key: 'ananya:medication',
      organizationId: org,
      patientId,
      purpose: 'MEDICATION_MANAGEMENT',
      categories: ['MEDICATIONS', 'ADHERENCE'],
      grantedDay: 0,
      validDays: 365,
      locale: 'te-IN',
    }),
    await insertConsent(db, {
      key: 'ananya:labs',
      organizationId: org,
      patientId,
      purpose: 'LAB_REVIEW',
      categories: ['LABS'],
      grantedDay: 0,
      validDays: 365,
      locale: 'te-IN',
    }),
    await insertConsent(db, {
      key: 'ananya:ai',
      organizationId: org,
      patientId,
      purpose: 'AI_ASSISTANCE',
      categories: [
        'ENCOUNTERS',
        'CONDITIONS',
        'ALLERGIES',
        'MEDICATIONS',
        'ADHERENCE',
        'LABS',
        'VITALS',
        'ACTIVITY',
      ],
      grantedDay: 0,
      validDays: 365,
      locale: 'te-IN',
    }),
  ];

  // Notifications (in-app inbox; nothing is sent anywhere) ---------------
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  if (by(85)) {
    notifications.push({
      id: seedId('notification:ananya:lab'),
      organizationId: org,
      recipientUserId: USER.ananya,
      patientProfileId: patientId,
      channel: 'IN_APP',
      templateKey: 'lab.result_available',
      locale: 'te-IN',
      params: { test: 'HbA1c' },
      status: until === 85 ? 'DELIVERED' : 'READ',
      dedupeKey: 'demo:ananya:lab:85',
      scheduledFor: at(85, '07:35'),
      sentAt: at(85, '07:35'),
      readAt: until === 85 ? null : at(85, '19:40'),
    });
  }
  if (by(91)) {
    notifications.push({
      id: seedId('notification:ananya:plan-end'),
      organizationId: org,
      recipientUserId: USER.ananya,
      patientProfileId: patientId,
      channel: 'IN_APP',
      templateKey: 'medication.course_completed',
      locale: 'te-IN',
      params: { medication: 'Metformin 500 mg' },
      status: 'DELIVERED',
      dedupeKey: 'demo:ananya:plan-end:90',
      scheduledFor: at(90, '20:00'),
      sentAt: at(90, '20:00'),
      deliveredAt: at(90, '20:00'),
    });
  }
  if (by(92)) {
    notifications.push({
      id: seedId('notification:ananya:appt'),
      organizationId: org,
      recipientUserId: USER.ananya,
      patientProfileId: patientId,
      channel: 'IN_APP',
      templateKey: 'appointment.reminder',
      locale: 'te-IN',
      params: { clinician: 'Dr. Meera Sharma', time: '10:30' },
      status: 'DELIVERED',
      dedupeKey: 'demo:ananya:appt:92',
      scheduledFor: at(91, '18:00'),
      sentAt: at(91, '18:00'),
      deliveredAt: at(91, '18:00'),
    });
  }
  if (notifications.length) await db.notification.createMany({ data: notifications });

  // A short, realistic access history for the "who saw my data" log -----
  const audit: SeedAuditEvent[] = consentIds.map((consentId, index) => ({
    key: `ananya:consent:${index}`,
    organizationId: org,
    day: index === 0 ? -182 : 0,
    clock: '10:00',
    actorUserId: USER.ananya,
    actorRoles: ['PATIENT'],
    patientProfileId: patientId,
    action: 'CONSENT_GRANT' as const,
    resourceType: 'Consent',
    resourceId: consentId,
  }));
  if (by(43)) {
    audit.push({
      key: 'ananya:read:adherence:42',
      organizationId: org,
      day: 42,
      clock: '16:00',
      actorUserId: USER.ravi,
      actorRoles: ['CARE_COORDINATOR'],
      patientProfileId: patientId,
      action: 'READ',
      resourceType: 'MedicationDoseEvent',
      resourceId: null,
      purposeCode: 'MEDICATION_MANAGEMENT',
      decision: 'ALLOW',
      decisionReason: 'ALLOWED',
    });
  }
  if (by(86)) {
    audit.push({
      key: 'ananya:read:labs:85',
      organizationId: org,
      day: 85,
      clock: '18:10',
      actorUserId: USER.meera,
      actorRoles: ['DOCTOR'],
      patientProfileId: patientId,
      action: 'READ',
      resourceType: 'LabResult',
      resourceId: null,
      purposeCode: 'LAB_REVIEW',
      decision: 'ALLOW',
      decisionReason: 'ALLOWED',
    });
  }
  await insertAuditEvents(db, audit);
}
