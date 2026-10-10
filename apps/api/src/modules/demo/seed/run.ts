import { averageOverWindow, calculateAdherence } from '@healthguard/clinical';
import type { DbClient } from '../../../infrastructure/prisma/create-client.js';
import { HERO, seedAnanya } from './ananya.js';
import { insertAuditEvents, type SeedDb } from './helpers.js';
import { seedOtherPatients } from './other-patients.js';
import { ORG, PATIENT, seedPeople, USER } from './people.js';
import {
  CONSENT_PURPOSES,
  DEFAULT_ACCESS_POLICY,
  LAB_TESTS,
  labTestId,
  MEDICATIONS,
  medicationId,
  purposeId,
} from './reference-data.js';
import {
  ANCHOR_DAY0,
  at,
  calendarDate,
  DEMO_TIMEZONE,
  seedId,
  TODAY_OFFSET_DAYS,
} from './scenario.js';

async function seedReferenceData(db: SeedDb): Promise<void> {
  await db.medication.createMany({
    data: Object.entries(MEDICATIONS).map(([key, med]) => ({
      id: medicationId(key as keyof typeof MEDICATIONS),
      ...med,
      brandNames: [],
    })),
  });
  await db.labTest.createMany({
    data: Object.entries(LAB_TESTS).map(([code, test]) => ({
      id: labTestId(code as keyof typeof LAB_TESTS),
      code,
      ...test,
    })),
  });
  await db.consentPurpose.createMany({
    data: CONSENT_PURPOSES.map((purpose) => ({ id: purposeId(purpose.code), ...purpose })),
  });
  await db.accessPolicy.createMany({
    data: DEFAULT_ACCESS_POLICY.flatMap((rule, ruleIndex) =>
      rule.categories.map((category) => ({
        id: seedId(`policy:${ruleIndex}:${rule.role}:${category}`),
        organizationId: null,
        role: rule.role,
        category,
        actions: rule.actions,
        requiresCareRelationship: rule.requiresCareRelationship,
        description: rule.description,
      })),
    ),
  });
}

export interface HeroNumbers {
  hba1cBefore: number | null;
  hba1cAfter: number | null;
  weightBefore: number | null;
  weightAfter: number | null;
  stepsBefore: number | null;
  stepsAfter: number | null;
  adherencePercent: number | null;
  dosesTaken: number;
  dosesDue: number;
}

/** Re-measures the hero numbers from the database with the same code the API uses. */
export async function measureHeroNumbers(db: SeedDb | DbClient): Promise<HeroNumbers> {
  const hba1c = await db.labResult.findMany({
    where: {
      patientProfileId: PATIENT.ananya,
      labTestId: labTestId('HBA1C'),
      effectiveAt: { gte: at(0, '00:00') },
    },
    orderBy: { effectiveAt: 'asc' },
  });
  const weights = await db.vital.findMany({
    where: { patientProfileId: PATIENT.ananya, type: 'BODY_WEIGHT' },
    orderBy: { measuredAt: 'asc' },
  });
  const steps = await db.activityMetric.findMany({
    where: { patientProfileId: PATIENT.ananya, type: 'STEPS' },
  });
  const points = steps.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    value: Number(row.value),
  }));
  const doses = await db.medicationDoseEvent.findMany({
    where: { patientProfileId: PATIENT.ananya },
  });
  const adherence = calculateAdherence(
    doses.map((dose) => ({
      planId: dose.medicationPlanId,
      scheduledAt: dose.scheduledAt,
      status: dose.status,
    })),
    { from: at(0, '00:00'), to: at(TODAY_OFFSET_DAYS, '00:00') },
  );
  return {
    hba1cBefore: hba1c[0] ? Number(hba1c[0].valueNumeric) : null,
    hba1cAfter: hba1c.at(-1) ? Number(hba1c.at(-1)?.valueNumeric) : null,
    weightBefore: weights[0] ? Number(weights[0].value) : null,
    weightAfter: weights.at(-1) ? Number(weights.at(-1)?.value) : null,
    stepsBefore: averageOverWindow(points, calendarDate(-30), calendarDate(-1), 20).value,
    stepsAfter: averageOverWindow(
      points,
      calendarDate(TODAY_OFFSET_DAYS - 30),
      calendarDate(TODAY_OFFSET_DAYS - 1),
      20,
    ).value,
    adherencePercent: adherence.percentage,
    dosesTaken: adherence.taken,
    dosesDue: adherence.due,
  };
}

function assertHeroNumbers(measured: HeroNumbers): void {
  const expected: HeroNumbers = {
    hba1cBefore: HERO.hba1cBefore,
    hba1cAfter: HERO.hba1cAfter,
    weightBefore: HERO.weightBefore,
    weightAfter: HERO.weightAfter,
    stepsBefore: HERO.stepsBefore,
    stepsAfter: HERO.stepsAfter,
    adherencePercent: HERO.adherencePercent,
    dosesTaken: HERO.dosesTaken,
    dosesDue: HERO.dosesDue,
  };
  for (const key of Object.keys(expected) as (keyof HeroNumbers)[]) {
    if (measured[key] !== expected[key]) {
      throw new Error(
        `Seed self-check failed: ${key} is ${String(measured[key])}, expected ${String(expected[key])}`,
      );
    }
  }
}

const TABLES = [
  'AIRecommendation',
  'SourceProvenance',
  'MedicationInstruction',
  'AIInteraction',
  'Notification',
  'AuditEvent',
  'AccessPolicy',
  'Consent',
  'Encounter',
  'Appointment',
  'FollowUp',
  'CarePlan',
  'LabResult',
  'Document',
  'ActivityMetric',
  'Vital',
  'MedicationDoseEvent',
  'MedicationPlan',
  'Immunization',
  'Procedure',
  'Allergy',
  'Condition',
  'PatientProfile',
  'ClinicianProfile',
  'OrganizationMember',
  'AuthSession',
  'Organization',
  'User',
  'ConsentPurpose',
  'LabTest',
  'Medication',
  'SystemSetting',
];

/**
 * Resets the database to the demo scenario. Refuses to run if any
 * non-demo organization exists, so it can never wipe real tenants.
 */
/** Story days the demo console can jump to. Day 92 is the default demo day. */
export const DEMO_CHECKPOINTS = [0, 6, 42, 85, 88, 92] as const;
export type DemoCheckpoint = (typeof DEMO_CHECKPOINTS)[number];

export function isDemoCheckpoint(day: number): day is DemoCheckpoint {
  return (DEMO_CHECKPOINTS as readonly number[]).includes(day);
}

export async function seedDemoData(
  db: DbClient,
  options: { passwordHash: string; checkpointDay?: number },
): Promise<HeroNumbers | null> {
  const until = options.checkpointDay ?? TODAY_OFFSET_DAYS;
  if (!isDemoCheckpoint(until)) {
    throw new Error(`Unknown demo checkpoint ${String(until)}; use one of ${DEMO_CHECKPOINTS.join(', ')}.`);
  }
  const realTenants = await db.organization.count({ where: { isDemo: false } });
  if (realTenants > 0) {
    throw new Error(
      `Refusing to seed: ${realTenants} non-demo organization(s) exist in this database.`,
    );
  }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
      );
      await seedReferenceData(tx);
      await seedPeople(tx, options.passwordHash);
      await seedAnanya(tx, until);
      await seedOtherPatients(tx, until);
      await tx.systemSetting.create({
        data: {
          key: 'demo.clock',
          value: {
            anchorDay0: ANCHOR_DAY0,
            offsetDays: until,
            timezone: DEMO_TIMEZONE,
          },
        },
      });
      await insertAuditEvents(tx, [
        {
          key: 'demo-reset',
          organizationId: null,
          day: until,
          clock: '07:00',
          actorUserId: null,
          actorRoles: ['SYSTEM'],
          patientProfileId: null,
          action: 'DEMO_RESET',
          resourceType: 'Database',
          resourceId: null,
          metadata: { anchorDay0: ANCHOR_DAY0, checkpointDay: until },
        },
      ]);
      // The hero numbers describe day 92; earlier checkpoints are partial stories.
      if (until !== TODAY_OFFSET_DAYS) return null;
      const measured = await measureHeroNumbers(tx);
      assertHeroNumbers(measured);
      return measured;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

export { ORG, PATIENT, USER };
