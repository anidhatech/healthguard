import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
  parseIsoDate,
  PatientIdParamsSchema,
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
import { zod } from '../../common/zod.pipe.js';
import type { Appointment, ClinicianProfile } from '../../generated/prisma/client.js';
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
}

@Module({ controllers: [AppointmentsController] })
export class AppointmentsModule {}
