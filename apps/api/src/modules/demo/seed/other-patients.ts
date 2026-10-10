import type { Prisma } from '../../../generated/prisma/client.js';
import { insertConsent, insertDailyDoses, insertPlan, SYNTHETIC, type SeedDb } from './helpers.js';
import { CLINICIAN, ORG, PATIENT, ROUTINES, USER } from './people.js';
import { LAB_TESTS, labTestId } from './reference-data.js';
import { at, calendarAt, dayDate, prng, seedId } from './scenario.js';

const ALL_CATEGORIES = [
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

/** Rahul Mehta: hypertension, Dr. Arjun Reddy's patient, Hindi. No AI consent. */
async function seedRahul(db: SeedDb, until: number): Promise<void> {
  const org = ORG.hdmc;
  const patientId = PATIENT.rahul;
  const encounterId = seedId('encounter:rahul:-60');
  await db.encounter.create({
    data: {
      id: encounterId,
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.arjun,
      type: 'OUTPATIENT',
      status: 'COMPLETED',
      reasonForVisit: 'Blood pressure review',
      startedAt: at(-60, '12:00'),
      endedAt: at(-60, '12:20'),
      recordedByUserId: USER.arjun,
      ...SYNTHETIC,
    },
  });
  await db.condition.create({
    data: {
      id: seedId('condition:rahul:htn'),
      organizationId: org,
      patientProfileId: patientId,
      encounterId,
      codeSystem: 'ICD-10',
      code: 'I10',
      display: 'Essential (primary) hypertension',
      onsetDate: calendarAt('2019-03-01'),
      verification: 'CLINICIAN_VERIFIED',
      ...SYNTHETIC,
    },
  });
  const planId = await insertPlan(db, {
    key: 'rahul-amlodipine',
    organizationId: org,
    patientId,
    prescriberId: CLINICIAN.arjun,
    encounterId,
    medication: 'amlodipine5',
    timing: 'MORN',
    offsetMinutes: null,
    durationDays: null,
    startDay: -59,
    status: 'ACTIVE',
    indication: 'Blood pressure',
    approvedByUserId: USER.arjun,
  });
  await insertDailyDoses(db, {
    planKey: 'rahul-amlodipine',
    planId,
    organizationId: org,
    patientId,
    patientUserId: USER.rahul,
    routine: ROUTINES.rahul,
    timing: 'MORN',
    offsetMinutes: null,
    startDay: -59,
    days: until + 59,
    outcome: (day) => (day % 9 === 0 ? 'MISSED' : 'TAKEN'),
    seed: 41,
  });
  const random = prng(42);
  const vitals: Prisma.VitalCreateManyInput[] = [];
  for (let day = -60; day <= until; day += 7) {
    vitals.push({
      id: seedId(`vital:rahul:bp:${day}`),
      organizationId: org,
      patientProfileId: patientId,
      type: 'BLOOD_PRESSURE',
      value: Math.round(146 - (day + 60) / 10 + random() * 4),
      value2: Math.round(92 - (day + 60) / 16 + random() * 3),
      unit: 'mmHg',
      measuredAt: at(day, '07:00'),
      ...SYNTHETIC,
    });
  }
  await db.vital.createMany({ data: vitals });
  await db.labResult.create({
    data: {
      id: seedId('lab:rahul:creatinine:-60'),
      organizationId: org,
      patientProfileId: patientId,
      labTestId: labTestId('CREATININE'),
      encounterId,
      valueNumeric: 1.0,
      unit: LAB_TESTS.CREATININE.unit,
      referenceLow: LAB_TESTS.CREATININE.referenceLow,
      referenceHigh: LAB_TESTS.CREATININE.referenceHigh,
      interpretation: 'NORMAL',
      effectiveAt: at(-60, '09:00'),
      ...SYNTHETIC,
    },
  });
  if (until >= 85) {
    await db.appointment.create({
      data: {
        id: seedId('appointment:rahul:92'),
        organizationId: org,
        patientProfileId: patientId,
        clinicianId: CLINICIAN.arjun,
        status: 'CONFIRMED',
        startAt: at(92, '11:30'),
        endAt: at(92, '11:50'),
        reason: 'Blood pressure follow-up',
        proposedAt: at(84, '10:00'),
        patientApprovedAt: at(84, '18:00'),
        patientApprovedByUserId: USER.rahul,
        confirmedAt: at(84, '19:00'),
        confirmedByUserId: USER.ravi,
      },
    });
  }
  await insertConsent(db, {
    key: 'rahul:consultation',
    organizationId: org,
    patientId,
    purpose: 'CONSULTATION',
    categories: [...ALL_CATEGORIES],
    grantedDay: -60,
    validDays: 365,
    locale: 'hi-IN',
  });
}

/** Priya Nair: hypothyroidism, short history, English. Has AI consent. */
async function seedPriya(db: SeedDb, until: number): Promise<void> {
  const org = ORG.hdmc;
  const patientId = PATIENT.priya;
  const encounterId = seedId('encounter:priya:-30');
  await db.encounter.create({
    data: {
      id: encounterId,
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.meera,
      type: 'TELECONSULT',
      status: 'COMPLETED',
      reasonForVisit: 'Thyroid results review',
      startedAt: at(-30, '17:00'),
      endedAt: at(-30, '17:15'),
      recordedByUserId: USER.meera,
      ...SYNTHETIC,
    },
  });
  await db.condition.create({
    data: {
      id: seedId('condition:priya:hypothyroid'),
      organizationId: org,
      patientProfileId: patientId,
      encounterId,
      codeSystem: 'ICD-10',
      code: 'E03.9',
      display: 'Hypothyroidism, unspecified',
      onsetDate: dayDate(-30),
      verification: 'CLINICIAN_VERIFIED',
      ...SYNTHETIC,
    },
  });
  const planId = await insertPlan(db, {
    key: 'priya-levothyroxine',
    organizationId: org,
    patientId,
    prescriberId: CLINICIAN.meera,
    encounterId,
    medication: 'levothyroxine50',
    timing: 'ACM',
    offsetMinutes: 30,
    durationDays: null,
    startDay: -29,
    status: 'ACTIVE',
    indication: 'Thyroid',
    approvedByUserId: USER.meera,
  });
  await insertDailyDoses(db, {
    planKey: 'priya-levothyroxine',
    planId,
    organizationId: org,
    patientId,
    patientUserId: USER.priya,
    routine: ROUTINES.priya,
    timing: 'ACM',
    offsetMinutes: 30,
    startDay: -29,
    days: until + 29,
    outcome: (day) => (day === -15 || day === 75 ? 'SKIPPED' : 'TAKEN'),
    seed: 51,
  });
  await db.labResult.create({
    data: {
      id: seedId('lab:priya:tsh:-32'),
      organizationId: org,
      patientProfileId: patientId,
      labTestId: labTestId('TSH'),
      valueNumeric: 7.9,
      unit: LAB_TESTS.TSH.unit,
      referenceLow: LAB_TESTS.TSH.referenceLow,
      referenceHigh: LAB_TESTS.TSH.referenceHigh,
      interpretation: 'HIGH',
      effectiveAt: at(-32, '08:30'),
      ...SYNTHETIC,
    },
  });
  await db.followUp.create({
    data: {
      id: seedId('follow-up:priya:tsh'),
      organizationId: org,
      patientProfileId: patientId,
      labTestId: labTestId('TSH'),
      type: 'REPEAT_TEST',
      origin: 'CLINICIAN',
      reason: 'Repeat TSH after 6 weeks',
      dueDate: dayDate(12),
      windowStart: dayDate(10),
      windowEnd: dayDate(20),
      status: until >= 13 ? 'COMPLETED' : until >= 10 ? 'DUE' : 'PLANNED',
      completedAt: until >= 13 ? at(12, '09:00') : null,
      createdByUserId: USER.meera,
    },
  });
  await insertConsent(db, {
    key: 'priya:consultation',
    organizationId: org,
    patientId,
    purpose: 'CONSULTATION',
    categories: [...ALL_CATEGORIES],
    grantedDay: -30,
    validDays: 365,
    locale: 'en-IN',
  });
  await insertConsent(db, {
    key: 'priya:ai',
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
    grantedDay: -30,
    validDays: 365,
    locale: 'en-IN',
  });
}

/** Kiran Joshi: a Lakeview patient with no app account. Proves tenant isolation. */
async function seedKiran(db: SeedDb): Promise<void> {
  const org = ORG.lakeview;
  const patientId = PATIENT.kiran;
  await db.encounter.create({
    data: {
      id: seedId('encounter:kiran:-40'),
      organizationId: org,
      patientProfileId: patientId,
      clinicianId: CLINICIAN.sameer,
      type: 'OUTPATIENT',
      status: 'COMPLETED',
      reasonForVisit: 'Annual check-up',
      startedAt: at(-40, '09:30'),
      endedAt: at(-40, '09:50'),
      ...SYNTHETIC,
    },
  });
  await db.labResult.create({
    data: {
      id: seedId('lab:kiran:hba1c:-40'),
      organizationId: org,
      patientProfileId: patientId,
      labTestId: labTestId('HBA1C'),
      valueNumeric: 5.4,
      unit: '%',
      referenceLow: 4,
      referenceHigh: 5.6,
      interpretation: 'NORMAL',
      effectiveAt: at(-40, '08:30'),
      ...SYNTHETIC,
    },
  });
  await insertConsent(db, {
    key: 'kiran:consultation',
    organizationId: org,
    patientId,
    purpose: 'CONSULTATION',
    categories: [...ALL_CATEGORIES],
    grantedDay: -40,
    validDays: 365,
    locale: 'hi-IN',
  });
}

/** The other patients' histories mostly predate day 0, so every checkpoint shows them. */
export async function seedOtherPatients(db: SeedDb, until: number): Promise<void> {
  await seedRahul(db, until);
  await seedPriya(db, until);
  await seedKiran(db);
}
