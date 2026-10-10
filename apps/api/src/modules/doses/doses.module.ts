import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DoseParamsSchema,
  DoseResponseRequestSchema,
  PatientIdParamsSchema,
  resolveLocale,
  TodayDosesQuerySchema,
  parseIsoDate,
  type DoseParams,
  type DoseResponseRequest,
  type PatientIdParams,
  type TodayDoseView,
  type TodayDosesQuery,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnly, iso, isoOrNull, strength } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { MedicationDoseEvent, PatientProfile } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { MISSED_GRACE_MINUTES, PENDING_DOSE_STATUSES, runDoseEngine } from './dose-engine.js';

/** Doses can be marked taken up to this long before their time. */
const EARLY_RESPONSE_MINUTES = 120;

const SKIP_REASON_TEXT: Record<string, string> = {
  FELT_UNWELL: 'Felt unwell',
  RAN_OUT: 'Ran out of medicine',
  FORGOT_TO_CARRY: 'Did not have the medicine with them',
  OTHER: 'Other reason',
};

@ApiTags('doses')
@Controller({ path: 'patients/:patientId/doses', version: '1' })
export class DosesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async engineClock() {
    return { demo: await this.clock.demoClock(), real: new Date() };
  }

  /** Brings this patient's doses up to date (the worker does the same every minute). */
  private async refresh(patient: PatientProfile): Promise<void> {
    await runDoseEngine(this.prisma.db, await this.engineClock(), { patientId: patient.id });
  }

  private respondable(dose: MedicationDoseEvent, now: Date, today: string): boolean {
    if ((PENDING_DOSE_STATUSES as readonly string[]).includes(dose.status)) {
      return dose.scheduledAt.getTime() - now.getTime() <= EARLY_RESPONSE_MINUTES * 60_000;
    }
    // A dose the system recorded as missed can still be answered the same day.
    return dose.status === 'MISSED' && dose.missedInferred && dateOnly(dose.localDate) === today;
  }

  @Get('today')
  @ApiOperation({ summary: "Today's doses with the approved instruction (rule-based reminders)" })
  async today(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(TodayDosesQuerySchema)) query: TodayDosesQuery,
  ): Promise<TodayDoseView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ADHERENCE',
      'MedicationDoseEvent',
    );
    await this.refresh(patient);
    const now = await this.clock.now(patient.timezone);
    const today = await this.clock.today(patient.timezone);
    const locale = query.locale ?? resolveLocale(patient.preferredLocale);
    const isSelf = actor.patientProfileIds.includes(patient.id);
    const rows = await this.prisma.tenant(patient.organizationId).medicationDoseEvent.findMany({
      where: {
        patientProfileId: patient.id,
        localDate: parseIsoDate(today),
        status: { not: 'CANCELLED' },
      },
      include: {
        plan: {
          include: {
            medication: true,
            instructions: { where: { status: 'APPROVED', locale } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      planId: row.medicationPlanId,
      medication: `${row.plan.medication.genericName} ${strength(row.plan.medication)}`,
      scheduledAt: iso(row.scheduledAt),
      localDate: dateOnly(row.localDate),
      slotLabel: row.slotLabel,
      status: row.status,
      respondedAt: isoOrNull(row.respondedAt),
      missedInferred: row.missedInferred,
      instruction: row.plan.instructions[0]?.doseText ?? null,
      reminderCount: row.reminderCount,
      remindAt: iso(row.remindAt),
      canRespond: isSelf && this.respondable(row, now, today),
    }));
  }

  @Post(':doseId/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'The patient answers a dose: taken, skipped or snooze' })
  async respond(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(DoseParamsSchema)) params: DoseParams,
    @Body(zod(DoseResponseRequestSchema)) body: DoseResponseRequest,
  ): Promise<{ id: string; status: string; respondedAt: string | null; remindAt: string }> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'MedicationDoseEvent');
    const patient = await this.prisma.db.patientProfile.findUnique({
      where: { id: params.patientId },
    });
    if (!patient) throw Problems.notFound('patient');
    const db = this.prisma.tenant(patient.organizationId);
    const dose = await db.medicationDoseEvent.findFirst({
      where: { id: params.doseId, patientProfileId: patient.id },
    });
    if (!dose) throw Problems.notFound('dose');
    const view = (row: MedicationDoseEvent) => ({
      id: row.id,
      status: row.status,
      respondedAt: isoOrNull(row.respondedAt),
      remindAt: iso(row.remindAt),
    });

    // Idempotent retries (a double tap, a flaky network) return the first answer.
    const previous = await db.medicationDoseEvent.findFirst({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (previous) {
      if (previous.id !== dose.id) throw Problems.conflict('This request key was already used.');
      return view(previous);
    }

    const now = await this.clock.now(patient.timezone);
    const today = await this.clock.today(patient.timezone);
    if (!this.respondable(dose, now, today)) {
      throw Problems.conflict(
        dose.scheduledAt > now
          ? 'This dose is not due yet.'
          : 'This dose can no longer be changed. Your care team can correct it if needed.',
      );
    }
    if (body.action === 'SNOOZED' && dose.status === 'MISSED') {
      throw Problems.conflict('A missed dose cannot be snoozed.');
    }
    if (
      body.action === 'SNOOZED' &&
      new Date(now.getTime() + body.minutes * 60_000).getTime() - dose.scheduledAt.getTime() >=
        MISSED_GRACE_MINUTES * 60_000
    ) {
      throw Problems.conflict('Snoozing that long would pass the time this dose counts as missed.');
    }

    const data =
      body.action === 'SNOOZED'
        ? {
            status: 'SNOOZED' as const,
            remindAt: new Date(now.getTime() + body.minutes * 60_000),
            idempotencyKey: body.idempotencyKey,
          }
        : {
            status: body.action,
            respondedAt: now,
            responseChannel: 'APP' as const,
            respondedByUserId: actor.userId,
            missedInferred: false,
            skipReason: body.action === 'SKIPPED' ? SKIP_REASON_TEXT[body.reason] : null,
            idempotencyKey: body.idempotencyKey,
          };
    const updated = await db.medicationDoseEvent.updateMany({
      where: { id: dose.id, status: dose.status },
      data,
    });
    if (updated.count === 0)
      throw Problems.conflict('This dose was just updated. Refresh and try again.');
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'UPDATE',
      resourceType: 'MedicationDoseEvent',
      resourceId: dose.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: {
        response: body.action,
        previousStatus: dose.status,
        lateAfterMissed: dose.status === 'MISSED',
        demoMode: this.config.demoMode,
      },
    });
    const fresh = await db.medicationDoseEvent.findFirstOrThrow({ where: { id: dose.id } });
    return view(fresh);
  }
}

@Module({ controllers: [DosesController] })
export class DosesModule {}
