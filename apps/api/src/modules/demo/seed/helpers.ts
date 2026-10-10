import {
  renderDoseInstruction,
  slotLabel,
  doseClockTime,
  type DailyRoutine,
} from '@healthguard/clinical';
import { SUPPORTED_LOCALES } from '@healthguard/shared';
import type {
  AuditAction,
  DataCategory,
  DoseStatus,
  EventTiming,
  Prisma,
} from '../../../generated/prisma/client.js';
import { auditContentHash } from '../../audit/audit-hash.js';
import { MEDICATIONS, medicationId, purposeId, type MedicationKey } from './reference-data.js';
import { at, calendarDate, dayDate, prng, seedId } from './scenario.js';

export type SeedDb = Prisma.TransactionClient;

/** Provenance columns shared by every synthetic clinical row. */
export const SYNTHETIC = {
  recordSource: 'SYNTHETIC_SEED',
  sourceSystem: 'healthguard-demo-seed',
} as const;

export interface PlanSeed {
  key: string;
  organizationId: string;
  patientId: string;
  prescriberId: string;
  encounterId?: string;
  medication: MedicationKey;
  timing: EventTiming;
  offsetMinutes: number | null;
  durationDays: number | null;
  startDay: number;
  status: 'ACTIVE' | 'COMPLETED';
  indication: string;
  approvedByUserId: string;
}

/** Inserts a signed plan and its reviewed instructions in all three languages. */
export async function insertPlan(db: SeedDb, plan: PlanSeed): Promise<string> {
  const med = MEDICATIONS[plan.medication];
  const id = seedId(`plan:${plan.key}`);
  const endDay = plan.durationDays ? plan.startDay + plan.durationDays - 1 : null;
  await db.medicationPlan.create({
    data: {
      id,
      organizationId: plan.organizationId,
      patientProfileId: plan.patientId,
      encounterId: plan.encounterId ?? null,
      medicationId: medicationId(plan.medication),
      prescriberId: plan.prescriberId,
      doseQuantity: 1,
      doseUnit: med.form === 'CAPSULE' ? 'CAPSULE' : 'TABLET',
      route: 'ORAL',
      frequency: 1,
      timingEvents: [plan.timing],
      timingOffsetMinutes: plan.offsetMinutes,
      durationDays: plan.durationDays,
      startDate: dayDate(plan.startDay),
      endDate: endDay === null ? null : dayDate(endDay),
      indication: plan.indication,
      status: plan.status,
      signedAt: at(plan.startDay - 1, '11:20'),
      verification: 'CLINICIAN_VERIFIED',
      ...SYNTHETIC,
    },
  });
  for (const locale of SUPPORTED_LOCALES) {
    const rendered = renderDoseInstruction(
      {
        drugName: med.genericName,
        strength: `${med.strengthValue} ${med.strengthUnit}`,
        doseQuantity: 1,
        doseUnit: med.form === 'CAPSULE' ? 'CAPSULE' : 'TABLET',
        frequency: 1,
        period: 1,
        periodUnit: 'DAY',
        timingEvents: [plan.timing],
        timingOffsetMinutes: plan.offsetMinutes,
        durationDays: plan.durationDays,
      },
      locale,
    );
    if (!rendered.ok)
      throw new Error(`No instruction template for ${plan.key}: ${rendered.reason}`);
    await db.medicationInstruction.create({
      data: {
        id: seedId(`instruction:${plan.key}:${locale}`),
        organizationId: plan.organizationId,
        medicationPlanId: id,
        locale,
        doseText: rendered.text,
        method: 'TEMPLATE_ONLY',
        templateKey: rendered.templateKey,
        validationStatus: 'PASSED',
        validationReport: { checks: ['template-render', 'preservation'], passed: true },
        status: 'APPROVED',
        approvedByUserId: plan.approvedByUserId,
        approvedAt: at(plan.startDay - 1, '11:25'),
      },
    });
  }
  return id;
}

/**
 * One dose a day for `days` days starting at `startDay`. `outcome(day)`
 * decides each dose; answered doses get a response a few minutes after the
 * scheduled time.
 */
export async function insertDailyDoses(
  db: SeedDb,
  args: {
    planKey: string;
    planId: string;
    organizationId: string;
    patientId: string;
    patientUserId: string | null;
    routine: DailyRoutine;
    timing: EventTiming;
    offsetMinutes: number | null;
    startDay: number;
    days: number;
    outcome: (day: number) => DoseStatus;
    seed: number;
  },
): Promise<void> {
  const clock = doseClockTime(args.routine, args.timing, args.offsetMinutes ?? 0);
  if (!clock) throw new Error(`Routine has no anchor for ${args.timing}`);
  const random = prng(args.seed);
  const rows: Prisma.MedicationDoseEventCreateManyInput[] = [];
  for (let day = args.startDay; day < args.startDay + args.days; day += 1) {
    const scheduledAt = at(day, clock);
    const status = args.outcome(day);
    const answered = status === 'TAKEN' || status === 'SKIPPED';
    rows.push({
      id: seedId(`dose:${args.planKey}:${day}`),
      organizationId: args.organizationId,
      patientProfileId: args.patientId,
      medicationPlanId: args.planId,
      scheduledAt,
      localDate: dayDate(day),
      slotLabel: slotLabel(args.timing, args.offsetMinutes),
      status,
      remindAt: scheduledAt,
      reminderCount: status === 'MISSED' ? 3 : 1,
      lastRemindedAt: scheduledAt,
      respondedAt: answered
        ? new Date(scheduledAt.getTime() + Math.round(2 + random() * 25) * 60_000)
        : null,
      responseChannel: answered ? 'APP' : status === 'MISSED' ? 'SYSTEM' : null,
      respondedByUserId: answered ? args.patientUserId : null,
      skipReason: status === 'SKIPPED' ? 'Patient chose to skip (reason given at clinic)' : null,
      missedInferred: status === 'MISSED',
      recordSource: 'SYNTHETIC_SEED',
    });
  }
  await db.medicationDoseEvent.createMany({ data: rows });
}

/** A granted consent from the patient to their organization (or one clinician). */
export async function insertConsent(
  db: SeedDb,
  args: {
    key: string;
    organizationId: string;
    patientId: string;
    purpose: string;
    categories: DataCategory[];
    granteeClinicianId?: string;
    grantedDay: number;
    validDays: number;
    locale: string;
  },
): Promise<string> {
  const id = seedId(`consent:${args.key}`);
  const grantedAt = at(args.grantedDay, '10:00');
  await db.consent.create({
    data: {
      id,
      organizationId: args.organizationId,
      patientProfileId: args.patientId,
      purposeId: purposeId(args.purpose),
      granteeType: args.granteeClinicianId ? 'CLINICIAN' : 'ORGANIZATION',
      granteeClinicianId: args.granteeClinicianId ?? null,
      categories: args.categories,
      validFrom: grantedAt,
      validUntil: new Date(grantedAt.getTime() + args.validDays * 86_400_000),
      status: 'GRANTED',
      method: 'DEMO_SEED',
      requestedAt: grantedAt,
      decidedAt: grantedAt,
      noticeVersion: 'consent-notice@1',
      noticeLocale: args.locale,
    },
  });
  return id;
}

export interface SeedAuditEvent {
  key: string;
  organizationId: string | null;
  day: number;
  clock: string;
  actorUserId: string | null;
  actorRoles: string[];
  patientProfileId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  purposeCode?: string | null;
  decision?: 'ALLOW' | 'DENY' | 'NOT_APPLICABLE';
  decisionReason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function insertAuditEvents(db: SeedDb, events: SeedAuditEvent[]): Promise<void> {
  const rows = events.map((event) => {
    const row = {
      id: seedId(`audit:${event.key}`),
      organizationId: event.organizationId,
      occurredAt: at(event.day, event.clock),
      actorType: event.actorUserId ? ('USER' as const) : ('SYSTEM' as const),
      actorUserId: event.actorUserId,
      actorRoles: event.actorRoles,
      aiAgent: null,
      patientProfileId: event.patientProfileId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      purposeCode: event.purposeCode ?? null,
      consentId: null,
      decision: event.decision ?? 'NOT_APPLICABLE',
      decisionReason: event.decisionReason ?? null,
      outcome: event.decision === 'DENY' ? ('FAILURE' as const) : ('SUCCESS' as const),
      requestId: null,
      metadata: { synthetic: true, ...(event.metadata ?? {}) },
    };
    return { ...row, metadata: row.metadata, contentHash: auditContentHash(row) };
  });
  await db.auditEvent.createMany({ data: rows });
}

export { calendarDate };
