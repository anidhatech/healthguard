import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PatientIdParamsSchema,
  type CarePlanView,
  type FollowUpView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnly, dateOnlyOrNull, isoOrNull } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('follow-ups')
@Controller({ path: 'patients/:patientId', version: '1' })
export class FollowUpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('care-plans')
  @ApiOperation({ summary: 'Care plans and goals' })
  async carePlans(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<CarePlanView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'CARE_PLAN',
      'CarePlan',
    );
    const rows = await this.prisma.tenant(patient.organizationId).carePlan.findMany({
      where: { patientProfileId: patient.id },
      include: { author: true },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      title: row.title,
      goals: Array.isArray(row.goals) ? row.goals.map(String) : [],
      status: row.status,
      startDate: dateOnly(row.startDate),
      endDate: dateOnlyOrNull(row.endDate),
      author: { id: row.author.id, displayName: row.author.displayName },
    }));
  }

  @Get('follow-ups')
  @ApiOperation({ summary: 'Follow-ups: repeat tests, call-backs and visits' })
  async followUps(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<FollowUpView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'CARE_PLAN',
      'FollowUp',
    );
    const rows = await this.prisma.tenant(patient.organizationId).followUp.findMany({
      where: { patientProfileId: patient.id },
      include: { labTest: true },
      orderBy: { dueDate: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      type: row.type,
      origin: row.origin,
      reason: row.reason,
      dueDate: dateOnly(row.dueDate),
      windowStart: dateOnlyOrNull(row.windowStart),
      windowEnd: dateOnlyOrNull(row.windowEnd),
      status: row.status,
      labTest: row.labTest ? { code: row.labTest.code, name: row.labTest.name } : null,
      completedAt: isoOrNull(row.completedAt),
    }));
  }
}

@Module({ controllers: [FollowUpsController] })
export class FollowUpsModule {}
