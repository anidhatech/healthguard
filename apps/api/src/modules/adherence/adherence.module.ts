import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
  AdherenceQuerySchema,
  DoseEventsQuerySchema,
  parseIsoDate,
  PatientIdParamsSchema,
  toIsoDate,
  zonedDayStart,
  type AdherenceQuery,
  type AdherenceSummary,
  type DoseEventsQuery,
  type DoseEventView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnly, iso, isoOrNull, strength } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { AdherenceService } from './adherence.service.js';

@ApiTags('adherence')
@Controller({ path: 'patients/:patientId', version: '1' })
export class AdherenceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly adherence: AdherenceService,
    private readonly clock: ClockService,
  ) {}

  @Get('adherence')
  @ApiOperation({ summary: 'Recorded adherence (calculated): taken ÷ (taken + skipped + missed)' })
  async summary(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(AdherenceQuerySchema)) query: AdherenceQuery,
  ): Promise<AdherenceSummary> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ADHERENCE',
      'AdherenceSummary',
    );
    const { longestMissedRunStart: _start, ...summary } = await this.adherence.summary(
      patient,
      query.since,
    );
    return summary;
  }

  @Get('dose-events')
  @ApiOperation({ summary: 'Dose events in a date range (default: the last 14 days)' })
  async doses(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(DoseEventsQuerySchema)) query: DoseEventsQuery,
  ): Promise<DoseEventView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ADHERENCE',
      'MedicationDoseEvent',
    );
    const today = await this.clock.today(patient.timezone);
    const to = query.to ?? today;
    const from = query.from ?? toIsoDate(addDays(parseIsoDate(to), -14));
    const rows = await this.prisma.tenant(patient.organizationId).medicationDoseEvent.findMany({
      where: {
        patientProfileId: patient.id,
        scheduledAt: {
          gte: zonedDayStart(from, patient.timezone),
          lt: zonedDayStart(toIsoDate(addDays(parseIsoDate(to), 1)), patient.timezone),
        },
      },
      include: { plan: { include: { medication: true } } },
      orderBy: { scheduledAt: 'desc' },
      take: 500,
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
    }));
  }
}

@Module({
  controllers: [AdherenceController],
  providers: [AdherenceService],
  exports: [AdherenceService],
})
export class AdherenceModule {}
