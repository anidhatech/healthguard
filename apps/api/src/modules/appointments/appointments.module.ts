import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
  AppointmentParamsSchema,
  AppointmentRequestSchema,
  CancelAppointmentSchema,
  parseIsoDate,
  PatientIdParamsSchema,
  ProposeAppointmentSchema,
  type AppointmentParams,
  type AppointmentRequest,
  type CancelAppointment,
  type ProposeAppointment,
  ScheduleQuerySchema,
  toIsoDate,
  zonedDayStart,
  type AppointmentView,
  type PatientIdParams,
  type ScheduleItem,
  type ScheduleQuery,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { iso, isoOrNull, patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import type {
  Appointment,
  ClinicianProfile,
  PatientProfile,
} from '../../generated/prisma/client.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

function view(row: Appointment & { clinician: ClinicianProfile }): AppointmentView {
  return {
    id: row.id,
    kind: 'FACT',
    status: row.status,
    mode: row.mode,
    startAt: iso(row.startAt),
    endAt: iso(row.endAt),
    reason: row.reason,
    clinician: { id: row.clinician.id, displayName: row.clinician.displayName },
    proposedAt: iso(row.proposedAt),
    patientApprovedAt: isoOrNull(row.patientApprovedAt),
    confirmedAt: isoOrNull(row.confirmedAt),
    cancelledAt: isoOrNull(row.cancelledAt),
  };
}

@ApiTags('appointments')
@Controller({ version: '1' })
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
  ) {}

  @Get('appointments/schedule')
  @Roles('DOCTOR', 'CARE_TEAM', 'FRONT_DESK')
  @ApiOperation({ summary: "A day's appointments in the organization (demographics only)" })
  async schedule(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Query(zod(ScheduleQuerySchema)) query: ScheduleQuery,
  ): Promise<ScheduleItem[]> {
    const organizationId = requireOrganization(actor);
    const org = await this.prisma.db.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const date = query.date ?? (await this.clock.today(org.timezone));
    const mine =
      (query.clinician ?? (actor.clinicianId ? 'me' : 'all')) === 'me' && actor.clinicianId;
    const rows = await this.prisma.tenant(organizationId).appointment.findMany({
      where: {
        startAt: {
          gte: zonedDayStart(date, org.timezone),
          lt: zonedDayStart(toIsoDate(addDays(parseIsoDate(date), 1)), org.timezone),
        },
        ...(mine ? { clinicianId: actor.clinicianId ?? undefined } : {}),
      },
      include: { clinician: true, patient: true },
      orderBy: { startAt: 'asc' },
    });
    await this.audit.record({
      actor,
      meta,
      action: 'READ',
      resourceType: 'Schedule',
      decision: 'ALLOW',
      decisionReason: 'DEMOGRAPHICS_ORGANIZATION_SCOPE',
      metadata: { date, count: rows.length },
    });
    return rows.map((row) => ({
      ...view(row),
      patient: {
        id: row.patient.id,
        displayName: patientDisplayName(row.patient),
        mrn: row.patient.mrn,
      },
    }));
  }

  @Get('patients/:patientId/appointments')
  @ApiOperation({ summary: "A patient's appointments" })
  async list(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AppointmentView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'APPOINTMENTS',
      'Appointment',
    );
    const rows = await this.prisma.tenant(patient.organizationId).appointment.findMany({
      where: { patientProfileId: patient.id },
      include: { clinician: true },
      orderBy: { startAt: 'desc' },
    });
    return rows.map(view);
  }

  private async notifyPatient(
    patient: PatientProfile,
    appointment: Appointment & { clinician: ClinicianProfile },
    templateKey: 'appointment.proposed' | 'appointment.confirmed' | 'appointment.cancelled',
  ): Promise<void> {
    if (!patient.userId) return;
    const now = new Date();
    await this.prisma.db.notification.create({
      data: {
        organizationId: patient.organizationId,
        recipientUserId: patient.userId,
        patientProfileId: patient.id,
        channel: 'IN_APP',
        templateKey,
        locale: patient.preferredLocale,
        params: {
          clinician: appointment.clinician.displayName,
          time: new Intl.DateTimeFormat('en-IN', {
            timeZone: patient.timezone,
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(appointment.startAt),
        },
        status: 'DELIVERED',
        dedupeKey: `appointment:${appointment.id}:${templateKey}`,
        scheduledFor: now,
        sentAt: now,
        deliveredAt: now,
        relatedEntityType: 'Appointment',
        relatedEntityId: appointment.id,
      },
    });
  }

  private async load(patient: PatientProfile, appointmentId: string) {
    const row = await this.prisma.tenant(patient.organizationId).appointment.findFirst({
      where: { id: appointmentId, patientProfileId: patient.id },
      include: { clinician: true },
    });
    if (!row) throw Problems.notFound('appointment');
    return row;
  }

  private async selfPatient(actor: ActorContext, meta: RequestMeta, patientId: string) {
    await this.patientAccess.requireSelf(actor, meta, patientId, 'Appointment');
    const patient = await this.prisma.db.patientProfile.findUnique({ where: { id: patientId } });
    if (!patient) throw Problems.notFound('patient');
    return patient;
  }

  /** Moves only from the expected status, so two people acting at once cannot both win. */
  private async transition(
    patient: PatientProfile,
    appointment: Appointment,
    from: Appointment['status'][],
    data: Partial<Appointment>,
  ): Promise<void> {
    if (!from.includes(appointment.status)) {
      throw Problems.conflict(
        `This appointment is ${appointment.status.toLowerCase().replace('_', ' ')}.`,
      );
    }
    const result = await this.prisma.tenant(patient.organizationId).appointment.updateMany({
      where: { id: appointment.id, status: appointment.status },
      data,
    });
    if (result.count === 0) throw Problems.conflict('This appointment was just changed.');
  }

  @Post('patients/:patientId/appointments')
  @HttpCode(201)
  @Roles('DOCTOR', 'CARE_TEAM')
  @ApiOperation({ summary: 'Propose a time; the patient must approve before it is confirmed' })
  async propose(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Body(zod(ProposeAppointmentSchema)) body: ProposeAppointment,
  ): Promise<AppointmentView> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'APPOINTMENTS',
      'Appointment',
      'CREATE',
    );
    const db = this.prisma.tenant(patient.organizationId);
    const clinician = await db.clinicianProfile.findFirst({ where: { id: body.clinicianId } });
    if (!clinician) throw Problems.notFound('clinician');
    const startAt = new Date(body.startAt);
    const endAt = new Date(startAt.getTime() + body.durationMinutes * 60_000);
    if (startAt <= (await this.clock.now(patient.timezone))) {
      throw Problems.conflict('Choose a time in the future.');
    }
    const clash = await db.appointment.findFirst({
      where: {
        clinicianId: clinician.id,
        status: { in: ['PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (clash) throw Problems.conflict(`${clinician.displayName} already has an appointment then.`);
    if (body.followUpId) {
      const followUp = await db.followUp.findFirst({
        where: { id: body.followUpId, patientProfileId: patient.id },
      });
      if (!followUp) throw Problems.notFound('follow-up');
    }
    const created = await db.appointment.create({
      data: {
        organizationId: patient.organizationId,
        patientProfileId: patient.id,
        clinicianId: clinician.id,
        followUpId: body.followUpId ?? null,
        mode: body.mode,
        status: 'PROPOSED',
        startAt,
        endAt,
        reason: body.reason,
        proposedAt: await this.clock.now(patient.timezone),
      },
      include: { clinician: true },
    });
    if (body.followUpId) {
      await db.followUp.update({ where: { id: body.followUpId }, data: { status: 'PROPOSED' } });
    }
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CREATE',
      resourceType: 'Appointment',
      resourceId: created.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { status: 'PROPOSED', mode: body.mode },
    });
    await this.notifyPatient(patient, created, 'appointment.proposed');
    return view(created);
  }

  @Post('patients/:patientId/appointments/:appointmentId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'The patient approves a proposed time' })
  async approve(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AppointmentParamsSchema)) params: AppointmentParams,
  ): Promise<AppointmentView> {
    const patient = await this.selfPatient(actor, meta, params.patientId);
    const appointment = await this.load(patient, params.appointmentId);
    await this.transition(patient, appointment, ['PROPOSED'], {
      status: 'PATIENT_APPROVED',
      patientApprovedAt: await this.clock.now(patient.timezone),
      patientApprovedByUserId: actor.userId,
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'STATUS_CHANGE',
      resourceType: 'Appointment',
      resourceId: appointment.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: { to: 'PATIENT_APPROVED' },
    });
    return view(await this.load(patient, appointment.id));
  }

  @Post('patients/:patientId/appointments/:appointmentId/confirm')
  @HttpCode(200)
  @Roles('DOCTOR', 'CARE_TEAM')
  @ApiOperation({ summary: 'Confirm a time the patient approved' })
  async confirm(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AppointmentParamsSchema)) params: AppointmentParams,
  ): Promise<AppointmentView> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'APPOINTMENTS',
      'Appointment',
      'UPDATE',
    );
    const appointment = await this.load(patient, params.appointmentId);
    if (appointment.status === 'PROPOSED') {
      throw Problems.conflict('The patient has not approved this time yet.');
    }
    await this.transition(patient, appointment, ['PATIENT_APPROVED'], {
      status: 'CONFIRMED',
      confirmedAt: await this.clock.now(patient.timezone),
      confirmedByUserId: actor.userId,
    });
    if (appointment.followUpId) {
      await this.prisma
        .tenant(patient.organizationId)
        .followUp.update({ where: { id: appointment.followUpId }, data: { status: 'SCHEDULED' } });
    }
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'STATUS_CHANGE',
      resourceType: 'Appointment',
      resourceId: appointment.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { to: 'CONFIRMED' },
    });
    const confirmed = await this.load(patient, appointment.id);
    await this.notifyPatient(patient, confirmed, 'appointment.confirmed');
    return view(confirmed);
  }

  @Post('patients/:patientId/appointments/:appointmentId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel or decline (the patient or the care team)' })
  async cancel(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AppointmentParamsSchema)) params: AppointmentParams,
    @Body(zod(CancelAppointmentSchema)) body: CancelAppointment,
  ): Promise<AppointmentView> {
    const isSelf = actor.patientProfileIds.includes(params.patientId);
    const patient = isSelf
      ? await this.selfPatient(actor, meta, params.patientId)
      : (
          await this.patientAccess.authorize(
            actor,
            meta,
            params.patientId,
            'APPOINTMENTS',
            'Appointment',
            'UPDATE',
          )
        ).patient;
    const appointment = await this.load(patient, params.appointmentId);
    await this.transition(patient, appointment, ['PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED'], {
      status: 'CANCELLED',
      cancelledAt: await this.clock.now(patient.timezone),
      cancellationReason: body.reason,
    });
    if (appointment.followUpId) {
      await this.prisma
        .tenant(patient.organizationId)
        .followUp.update({ where: { id: appointment.followUpId }, data: { status: 'DUE' } });
    }
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'STATUS_CHANGE',
      resourceType: 'Appointment',
      resourceId: appointment.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: isSelf ? 'SELF' : null,
      metadata: { to: 'CANCELLED', reason: body.reason },
    });
    const cancelled = await this.load(patient, appointment.id);
    if (!isSelf) await this.notifyPatient(patient, cancelled, 'appointment.cancelled');
    return view(cancelled);
  }

  @Post('patients/:patientId/appointment-requests')
  @HttpCode(201)
  @ApiOperation({ summary: 'The patient asks for a visit; the care team proposes a time' })
  async request(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Body(zod(AppointmentRequestSchema)) body: AppointmentRequest,
  ): Promise<{ followUpId: string; status: string; dueDate: string }> {
    const patient = await this.selfPatient(actor, meta, params.patientId);
    const db = this.prisma.tenant(patient.organizationId);
    const open = await db.followUp.findFirst({
      where: {
        patientProfileId: patient.id,
        type: 'VISIT',
        origin: 'PATIENT_REQUEST',
        status: { in: ['DUE', 'PROPOSED'] },
      },
    });
    if (open)
      throw Problems.conflict('You already asked for a visit. The care team will propose a time.');
    const today = await this.clock.today(patient.timezone);
    const dueDate = addDays(parseIsoDate(today), body.preferredWindow === 'NEXT_WEEK' ? 7 : 2);
    const reasonText: Record<AppointmentRequest['reason'], string> = {
      FOLLOW_UP: 'follow-up visit',
      NEW_PROBLEM: 'a new problem',
      REPORT_REVIEW: 'review a report',
      OTHER: 'other',
    };
    const followUp = await db.followUp.create({
      data: {
        organizationId: patient.organizationId,
        patientProfileId: patient.id,
        type: 'VISIT',
        origin: 'PATIENT_REQUEST',
        reason: `Patient asked for a visit: ${reasonText[body.reason]} (${body.preferredWindow
          .toLowerCase()
          .replace('_', ' ')}).`,
        dueDate,
        status: 'DUE',
        createdByUserId: actor.userId,
      },
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
      metadata: { type: 'VISIT', reason: body.reason },
    });
    return { followUpId: followUp.id, status: followUp.status, dueDate: toIsoDate(dueDate) };
  }
}

@Module({ controllers: [AppointmentsController] })
export class AppointmentsModule {}
