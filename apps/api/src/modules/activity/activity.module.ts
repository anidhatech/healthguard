import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { averageOverWindow } from '@healthguard/clinical';
import {
  ActivityQuerySchema,
  addDays,
  parseIsoDate,
  PatientIdParamsSchema,
  toIsoDate,
  VitalsQuerySchema,
  type ActivityQuery,
  type ActivitySeries,
  type PatientIdParams,
  type ProgressSummary,
  type VitalsQuery,
  type VitalView,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnly, iso, num, provenance } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AdherenceModule } from '../adherence/adherence.module.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { PROGRESS_CATEGORY, ProgressService } from './progress.service.js';

const UNITS: Record<ActivitySeries['metric'], string> = {
  STEPS: 'steps',
  SLEEP_DURATION: 'minutes',
  ACTIVE_MINUTES: 'minutes',
  RESTING_HEART_RATE: 'bpm',
  WORKOUT_MINUTES: 'minutes',
};

@ApiTags('activity')
@Controller({ path: 'patients/:patientId', version: '1' })
export class ActivityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly clock: ClockService,
    private readonly progress: ProgressService,
  ) {}

  @Get('vitals')
  @ApiOperation({ summary: 'Vital signs (weight, blood pressure, …), newest first' })
  async vitals(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(VitalsQuerySchema)) query: VitalsQuery,
  ): Promise<VitalView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'VITALS',
      'Vital',
    );
    const rows = await this.prisma.tenant(patient.organizationId).vital.findMany({
      where: {
        patientProfileId: patient.id,
        recordStatus: 'ACTIVE',
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { measuredAt: 'desc' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      type: row.type,
      value: num(row.value) ?? 0,
      value2: num(row.value2),
      unit: row.unit,
      measuredAt: iso(row.measuredAt),
      context: row.context,
    }));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Daily activity series with a calculated 30-day average' })
  async activity(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(ActivityQuerySchema)) query: ActivityQuery,
  ): Promise<ActivitySeries> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ACTIVITY',
      'ActivityMetric',
    );
    const today = await this.clock.today(patient.timezone);
    const to = toIsoDate(addDays(parseIsoDate(today), -1));
    const from = toIsoDate(addDays(parseIsoDate(today), -query.days));
    const rows = await this.prisma.tenant(patient.organizationId).activityMetric.findMany({
      where: {
        patientProfileId: patient.id,
        type: query.metric,
        recordStatus: 'ACTIVE',
        date: { gte: parseIsoDate(from), lte: parseIsoDate(to) },
      },
      orderBy: { date: 'asc' },
    });
    const points = rows.map((row) => ({ date: dateOnly(row.date), value: num(row.value) ?? 0 }));
    const averageFrom = toIsoDate(addDays(parseIsoDate(today), -30));
    const average = averageOverWindow(points, averageFrom, to, 20);
    return {
      kind: 'FACT',
      metric: query.metric,
      unit: UNITS[query.metric],
      from,
      to,
      points,
      sourceSystems: [...new Set(rows.map((row) => row.sourceSystem))],
      average: { kind: 'CALCULATED', ...average },
    };
  }

  @Get('progress')
  @ApiOperation({
    summary:
      'Since-the-last-visit comparisons (calculated, with sources); hidden metrics are listed',
  })
  async summary(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<ProgressSummary> {
    const { patient, allowed } = await this.patientAccess.authorizeCategories(
      actor,
      meta,
      params.patientId,
      [...new Set(Object.values(PROGRESS_CATEGORY))],
      'ProgressSummary',
    );
    return this.progress.compute(patient, allowed);
  }
}

@Module({
  imports: [AdherenceModule],
  controllers: [ActivityController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ActivityModule {}
