import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CompleteFollowUpSchema,
  EMERGENCY_NUMBERS,
  HelpRequestSchema,
  IdParamsSchema,
  PatientIdParamsSchema,
  type CareQueueItem,
  type CompleteFollowUp,
  type HelpRequest,
  type HelpRequestResult,
  type IdParams,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { dateOnly, iso, patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AccessService } from '../consent/access.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { raiseCallback } from '../doses/dose-engine.js';

const HELP_REASON_TEXT: Record<HelpRequest['reason'], string> = {
  SIDE_EFFECT: 'possible side effect',
  MEDICINE_QUESTION: 'question about a medicine',
  MISSED_DOSES: 'missed doses',
  OTHER: 'other',
};

const OUTCOME_TEXT: Record<CompleteFollowUp['outcome'], string> = {
  CALLED_RESOLVED: 'Called; resolved',
  CALLED_ESCALATED_TO_DOCTOR: 'Called; passed to the doctor',
  NO_ANSWER_CLOSED: 'No answer; closed',
};

@ApiTags('care-team')
@Controller({ version: '1' })
export class CareTeamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  @Post('patients/:patientId/help-requests')
  @HttpCode(201)
  @ApiOperation({
    summary: '"Need help": asks the care team to call back. Not for emergencies (call 112/108).',
  })
  async requestHelp(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Body(zod(HelpRequestSchema)) body: HelpRequest,
  ): Promise<HelpRequestResult> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'FollowUp');
    const patient = await this.prisma.db.patientProfile.findUnique({
      where: { id: params.patientId },
    });
    if (!patient) throw Problems.notFound('patient');
    if (body.doseId) {
      const dose = await this.prisma.tenant(patient.organizationId).medicationDoseEvent.findFirst({
        where: { id: body.doseId, patientProfileId: patient.id },
      });
      if (!dose) throw Problems.notFound('dose');
    }
    const today = await this.clock.today(patient.timezone);
    const reason = `Patient asked for a call back: ${HELP_REASON_TEXT[body.reason]}.${
      body.note ? ` Patient's note: "${body.note}"` : ''
    }`;
    const followUp = await raiseCallback(this.prisma.db, {
      organizationId: patient.organizationId,
      patientProfileId: patient.id,
      origin: 'PATIENT_REQUEST',
      reason,
      dueDate: today,
      createdByUserId: actor.userId,
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CREATE',
      resourceType: 'FollowUp',
      resourceId: followUp.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      // The reason code only: the patient's note never goes into the audit trail.
      metadata: {
        helpReason: body.reason,
        alreadyOpen: !followUp.created,
        hasNote: Boolean(body.note),
      },
    });
    return {
      followUpId: followUp.id,
      status: followUp.status,
      dueDate: dateOnly(followUp.dueDate),
      emergencyNumbers: EMERGENCY_NUMBERS.map((entry) => ({ ...entry })),
      message: followUp.created
        ? 'Your care team will call you back. This is not an emergency service.'
        : 'Your care team already has a call-back request from you and will call.',
    };
  }

  @Get('care-queue')
  @Roles('DOCTOR', 'CARE_TEAM')
  @ApiOperation({ summary: 'Open call-backs and due follow-ups for the care team' })
  async queue(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
  ): Promise<CareQueueItem[]> {
    const organizationId = requireOrganization(actor);
    const rows = await this.prisma.tenant(organizationId).followUp.findMany({
      where: {
        OR: [
          { type: { in: ['CALLBACK', 'REVIEW'] }, status: { in: ['DUE', 'OVERDUE', 'PLANNED'] } },
          { type: { in: ['VISIT', 'REPEAT_TEST'] }, status: { in: ['DUE', 'OVERDUE'] } },
        ],
      },
      include: { patient: true, assignedMember: { include: { user: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    // Each patient's care-plan data still goes through the access decision.
    const allowed = new Set<string>();
    for (const patientId of new Set(rows.map((row) => row.patientProfileId))) {
      const decision = await this.access.decide(actor, patientId, 'CARE_PLAN');
      if (decision.allowed) allowed.add(patientId);
    }
    const today = await this.clock.today();
    const items = rows
      .filter((row) => allowed.has(row.patientProfileId))
      .map((row) => ({
        id: row.id,
        kind: 'FACT' as const,
        patient: {
          id: row.patient.id,
          displayName: patientDisplayName(row.patient),
          mrn: row.patient.mrn,
        },
        type: row.type,
        origin: row.origin,
        reason: row.reason,
        status: row.status,
        dueDate: dateOnly(row.dueDate),
        overdue: dateOnly(row.dueDate) < today,
        assignedTo: row.assignedMember?.user.displayName ?? null,
        createdAt: iso(row.createdAt),
      }));
    await this.audit.record({
      actor,
      meta,
      action: 'READ',
      resourceType: 'CareQueue',
      decision: 'ALLOW',
      decisionReason: 'CARE_PLAN_PER_PATIENT',
      metadata: { count: items.length, hidden: rows.length - items.length },
    });
    return items;
  }

  @Post('care-queue/:id/complete')
  @HttpCode(200)
  @Roles('DOCTOR', 'CARE_TEAM')
  @ApiOperation({ summary: 'Close a call-back with an outcome' })
  async complete(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(IdParamsSchema)) params: IdParams,
    @Body(zod(CompleteFollowUpSchema)) body: CompleteFollowUp,
  ): Promise<{ id: string; status: string }> {
    const organizationId = requireOrganization(actor);
    const db = this.prisma.tenant(organizationId);
    const followUp = await db.followUp.findFirst({ where: { id: params.id } });
    if (!followUp) throw Problems.notFound('follow-up');
    await this.patientAccess.authorize(
      actor,
      meta,
      followUp.patientProfileId,
      'CARE_PLAN',
      'FollowUp',
      'UPDATE',
    );
    if (!['DUE', 'OVERDUE', 'PLANNED'].includes(followUp.status)) {
      throw Problems.conflict('This follow-up is already closed.');
    }
    const now = await this.clock.now();
    await db.followUp.update({
      where: { id: followUp.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        reason: `${followUp.reason} — ${OUTCOME_TEXT[body.outcome]} (${actor.displayName}).`,
      },
    });
    await this.audit.record({
      actor,
      meta,
      action: 'STATUS_CHANGE',
      resourceType: 'FollowUp',
      resourceId: followUp.id,
      patientProfileId: followUp.patientProfileId,
      decision: 'ALLOW',
      metadata: { to: 'COMPLETED', outcome: body.outcome },
    });
    return { id: followUp.id, status: 'COMPLETED' };
  }
}

@Module({ controllers: [CareTeamController] })
export class CareTeamModule {}
