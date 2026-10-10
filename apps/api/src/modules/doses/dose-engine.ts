/**
 * The dose engine: turns signed medication plans into dose events, sends
 * simulated reminders, infers missed doses and raises call-backs. It runs in
 * the worker every minute and, for one patient at a time, when the API needs
 * today's doses. Everything here is a deterministic rule, never a model output,
 * and it never changes a prescription.
 */
import { randomUUID } from 'node:crypto';
import { doseClockTime, slotLabel, type DailyRoutine } from '@healthguard/clinical';
import { addDays, localIsoDate, parseIsoDate, toIsoDate, zonedDateTime } from '@healthguard/shared';
import type { DbClient } from '../../infrastructure/prisma/create-client.js';
import { demoNow, type DemoClock } from '../../infrastructure/clock/clock.service.js';
import { auditContentHash } from '../audit/audit-hash.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** A dose still unanswered this long after its time is recorded as missed. */
export const MISSED_GRACE_MINUTES = 120;
/** Reminders repeat at this interval, at most `MAX_REMINDERS` times. */
export const REMINDER_INTERVAL_MINUTES = 30;
export const MAX_REMINDERS = 3;
/** Consecutive missed doses of one plan that raise a care-team call-back. */
export const MISSED_RUN_FOR_CALLBACK = 2;

export const PENDING_DOSE_STATUSES = ['SCHEDULED', 'REMINDED', 'SNOOZED'] as const;

export interface EngineClock {
  demo: DemoClock | null;
  real: Date;
}

interface Scope {
  patientId?: string;
}

function nowFor(clock: EngineClock, timezone: string): Date {
  return demoNow(clock.demo, clock.real, timezone);
}

async function systemAudit(
  db: DbClient | Prisma.TransactionClient,
  event: {
    organizationId: string;
    patientProfileId: string | null;
    action: 'CREATE' | 'STATUS_CHANGE';
    resourceType: string;
    resourceId: string;
    reason: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const row = {
    id: randomUUID(),
    organizationId: event.organizationId,
    occurredAt: new Date(),
    actorType: 'SYSTEM' as const,
    actorUserId: null,
    actorRoles: ['SYSTEM'],
    patientProfileId: event.patientProfileId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    purposeCode: null,
    decision: 'NOT_APPLICABLE' as const,
    decisionReason: event.reason,
    outcome: 'SUCCESS' as const,
    requestId: null,
    metadata: event.metadata,
  };
  await db.auditEvent.create({
    data: { ...row, metadata: row.metadata as Prisma.InputJsonValue, contentHash: auditContentHash(row) },
  });
}

/** Local `HH:MM` times for one day of a plan, from timing events and fixed times. */
export function planClockTimes(
  plan: { timingEvents: string[]; timingOffsetMinutes: number | null; timesOfDay: string[] },
  routine: DailyRoutine,
): { clock: string; slot: string }[] {
  const slots = plan.timingEvents.flatMap((event) => {
    const clock = doseClockTime(routine, event, plan.timingOffsetMinutes ?? 0);
    return clock ? [{ clock, slot: slotLabel(event, plan.timingOffsetMinutes) }] : [];
  });
  for (const clock of plan.timesOfDay) slots.push({ clock, slot: clock });
  return slots;
}

/**
 * Creates dose events for active plans from today forward. Never backfills
 * earlier days, never creates a dose before the plan was signed, and is safe to
 * run repeatedly (unique on plan + time).
 */
export async function materializeDoses(
  db: DbClient,
  clock: EngineClock,
  scope: Scope & { days?: number } = {},
): Promise<number> {
  const plans = await db.medicationPlan.findMany({
    where: {
      status: 'ACTIVE',
      asNeeded: false,
      periodUnit: 'DAY',
      signedAt: { not: null },
      ...(scope.patientId ? { patientProfileId: scope.patientId } : {}),
    },
    include: { patient: { select: { timezone: true, dailyRoutine: true } } },
  });
  const rows: Prisma.MedicationDoseEventCreateManyInput[] = [];
  for (const plan of plans) {
    const timezone = plan.patient.timezone;
    const today = localIsoDate(nowFor(clock, timezone), timezone);
    const slots = planClockTimes(plan, plan.patient.dailyRoutine as DailyRoutine);
    for (let offset = 0; offset < (scope.days ?? 1); offset += 1) {
      const date = toIsoDate(addDays(parseIsoDate(today), offset));
      if (date < toIsoDate(plan.startDate)) continue;
      if (plan.endDate && date > toIsoDate(plan.endDate)) continue;
      // Once a day for frequency 1; a plan every N days only on matching days.
      const sinceStart = Math.round(
        (parseIsoDate(date).getTime() - plan.startDate.getTime()) / 86_400_000,
      );
      if (plan.period > 1 && sinceStart % plan.period !== 0) continue;
      for (const { clock: time, slot } of slots) {
        const scheduledAt = zonedDateTime(date, time, timezone);
        if (plan.signedAt && scheduledAt < plan.signedAt) continue;
        rows.push({
          organizationId: plan.organizationId,
          patientProfileId: plan.patientProfileId,
          medicationPlanId: plan.id,
          scheduledAt,
          localDate: parseIsoDate(date),
          slotLabel: slot,
          status: 'SCHEDULED',
          remindAt: scheduledAt,
        });
      }
    }
  }
  if (rows.length === 0) return 0;
  const result = await db.medicationDoseEvent.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/** Cancels future unanswered doses when a plan stops, completes or is superseded. */
export async function cancelFutureDoses(
  db: DbClient | Prisma.TransactionClient,
  planId: string,
  from: Date,
): Promise<number> {
  const result = await db.medicationDoseEvent.updateMany({
    where: {
      medicationPlanId: planId,
      status: { in: [...PENDING_DOSE_STATUSES] },
      scheduledAt: { gte: from },
    },
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

/**
 * Sends simulated phone reminders for doses whose reminder time has come.
 * Nothing leaves the system: the "phone" is the in-app simulated phone panel.
 */
export async function sendDueReminders(
  db: DbClient,
  clock: EngineClock,
  scope: Scope = {},
): Promise<number> {
  const candidates = await db.medicationDoseEvent.findMany({
    where: {
      status: { in: [...PENDING_DOSE_STATUSES] },
      reminderCount: { lt: MAX_REMINDERS },
      ...(scope.patientId ? { patientProfileId: scope.patientId } : {}),
    },
    include: {
      patient: { select: { userId: true, timezone: true, preferredLocale: true } },
      plan: { include: { medication: true } },
    },
    orderBy: { remindAt: 'asc' },
    take: 500,
  });
  let sent = 0;
  for (const dose of candidates) {
    const now = nowFor(clock, dose.patient.timezone);
    if (dose.remindAt > now) continue;
    if (now.getTime() - dose.scheduledAt.getTime() >= MISSED_GRACE_MINUTES * 60_000) continue;
    const count = dose.reminderCount + 1;
    await db.$transaction(async (tx) => {
      const updated = await tx.medicationDoseEvent.updateMany({
        where: { id: dose.id, status: dose.status, reminderCount: dose.reminderCount },
        data: {
          status: 'REMINDED',
          reminderCount: count,
          lastRemindedAt: now,
          remindAt: new Date(now.getTime() + REMINDER_INTERVAL_MINUTES * 60_000),
        },
      });
      if (updated.count === 0 || !dose.patient.userId) return;
      const medication = dose.plan.medication;
      await tx.notification.create({
        data: {
          organizationId: dose.organizationId,
          recipientUserId: dose.patient.userId,
          patientProfileId: dose.patientProfileId,
          channel: 'SIMULATED_PHONE',
          templateKey: 'dose.reminder',
          locale: dose.patient.preferredLocale,
          params: {
            medication: `${medication.genericName} ${medication.strengthValue.toString()} ${medication.strengthUnit}`,
            time: new Intl.DateTimeFormat('en-IN', {
              timeZone: dose.patient.timezone,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(dose.scheduledAt),
            doseId: dose.id,
          },
          status: 'DELIVERED',
          dedupeKey: `dose:${dose.id}:reminder:${count}`,
          scheduledFor: now,
          sentAt: now,
          deliveredAt: now,
          relatedEntityType: 'MedicationDoseEvent',
          relatedEntityId: dose.id,
        },
      });
      sent += 1;
    });
  }
  return sent;
}

/** The first active care coordinator in the organization, else a nurse. */
async function careTeamAssignee(
  db: DbClient | Prisma.TransactionClient,
  organizationId: string,
): Promise<{ id: string; userId: string } | null> {
  for (const role of ['CARE_COORDINATOR', 'NURSE'] as const) {
    const member = await db.organizationMember.findFirst({
      where: { organizationId, status: 'ACTIVE', deletedAt: null, roles: { has: role } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });
    if (member) return member;
  }
  return null;
}

/**
 * Raises a call-back for the care team, unless one from the same origin is
 * still open. Returns the follow-up and whether it was new.
 */
export async function raiseCallback(
  db: DbClient | Prisma.TransactionClient,
  args: {
    organizationId: string;
    patientProfileId: string;
    origin: 'RULE' | 'PATIENT_REQUEST';
    reason: string;
    dueDate: string;
    createdByUserId: string | null;
  },
): Promise<{ id: string; status: string; dueDate: Date; created: boolean }> {
  const open = await db.followUp.findFirst({
    where: {
      organizationId: args.organizationId,
      patientProfileId: args.patientProfileId,
      type: 'CALLBACK',
      origin: args.origin,
      status: { in: ['PLANNED', 'DUE', 'OVERDUE'] },
    },
  });
  if (open) return { id: open.id, status: open.status, dueDate: open.dueDate, created: false };
  const assignee = await careTeamAssignee(db, args.organizationId);
  const followUp = await db.followUp.create({
    data: {
      organizationId: args.organizationId,
      patientProfileId: args.patientProfileId,
      assignedMemberId: assignee?.id ?? null,
      type: 'CALLBACK',
      origin: args.origin,
      reason: args.reason,
      dueDate: parseIsoDate(args.dueDate),
      status: 'DUE',
      createdByUserId: args.createdByUserId,
    },
  });
  if (assignee) {
    await db.notification.create({
      data: {
        organizationId: args.organizationId,
        recipientUserId: assignee.userId,
        patientProfileId: args.patientProfileId,
        channel: 'IN_APP',
        templateKey:
          args.origin === 'RULE' ? 'care.callback_missed_doses' : 'care.callback_requested',
        locale: 'en-IN',
        params: {},
        status: 'DELIVERED',
        dedupeKey: `follow-up:${followUp.id}:assigned`,
        scheduledFor: new Date(),
        sentAt: new Date(),
        deliveredAt: new Date(),
        relatedEntityType: 'FollowUp',
        relatedEntityId: followUp.id,
      },
    });
  }
  return { id: followUp.id, status: followUp.status, dueDate: followUp.dueDate, created: true };
}

/**
 * Records unanswered doses as missed once the grace period has passed, then
 * raises a call-back when a plan has `MISSED_RUN_FOR_CALLBACK` misses in a row.
 */
export async function inferMissedDoses(
  db: DbClient,
  clock: EngineClock,
  scope: Scope = {},
): Promise<{ missed: number; callbacks: number }> {
  const pending = await db.medicationDoseEvent.findMany({
    where: {
      status: { in: [...PENDING_DOSE_STATUSES] },
      ...(scope.patientId ? { patientProfileId: scope.patientId } : {}),
    },
    include: { patient: { select: { timezone: true } } },
    take: 2000,
  });
  const affectedPlans = new Map<string, { organizationId: string; patientId: string; tz: string }>();
  let missed = 0;
  for (const dose of pending) {
    const now = nowFor(clock, dose.patient.timezone);
    if (now.getTime() - dose.scheduledAt.getTime() < MISSED_GRACE_MINUTES * 60_000) continue;
    const updated = await db.medicationDoseEvent.updateMany({
      where: { id: dose.id, status: dose.status },
      data: { status: 'MISSED', missedInferred: true, responseChannel: 'SYSTEM' },
    });
    if (updated.count === 0) continue;
    missed += 1;
    affectedPlans.set(dose.medicationPlanId, {
      organizationId: dose.organizationId,
      patientId: dose.patientProfileId,
      tz: dose.patient.timezone,
    });
  }
  let callbacks = 0;
  for (const [planId, plan] of affectedPlans) {
    const now = nowFor(clock, plan.tz);
    const recent = await db.medicationDoseEvent.findMany({
      where: {
        medicationPlanId: planId,
        status: { in: ['TAKEN', 'SKIPPED', 'MISSED'] },
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'desc' },
      take: MISSED_RUN_FOR_CALLBACK,
      select: { status: true },
    });
    if (
      recent.length < MISSED_RUN_FOR_CALLBACK ||
      recent.some((dose) => dose.status !== 'MISSED')
    ) {
      continue;
    }
    const followUp = await raiseCallback(db, {
      organizationId: plan.organizationId,
      patientProfileId: plan.patientId,
      origin: 'RULE',
      reason: `Doses recorded as missed ${MISSED_RUN_FOR_CALLBACK} times in a row (calculated). Call to check in.`,
      dueDate: localIsoDate(now, plan.tz),
      createdByUserId: null,
    });
    if (followUp.created) {
      callbacks += 1;
      await systemAudit(db, {
        organizationId: plan.organizationId,
        patientProfileId: plan.patientId,
        action: 'CREATE',
        resourceType: 'FollowUp',
        resourceId: followUp.id,
        reason: 'MISSED_DOSE_RULE',
        metadata: { rule: 'consecutive-missed', run: MISSED_RUN_FOR_CALLBACK },
      });
    }
  }
  return { missed, callbacks };
}

/** One pass of the engine, in the order the worker runs it. */
export async function runDoseEngine(
  db: DbClient,
  clock: EngineClock,
  scope: Scope = {},
): Promise<{ created: number; reminded: number; missed: number; callbacks: number }> {
  const created = await materializeDoses(db, clock, scope);
  const reminded = await sendDueReminders(db, clock, scope);
  const { missed, callbacks } = await inferMissedDoses(db, clock, scope);
  return { created, reminded, missed, callbacks };
}
