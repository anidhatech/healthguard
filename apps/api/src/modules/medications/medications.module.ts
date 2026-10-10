import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MedicationCatalogueQuerySchema,
  MedicationPlansQuerySchema,
  PatientIdParamsSchema,
  resolveLocale,
  type MedicationCatalogueItem,
  type MedicationCatalogueQuery,
  type MedicationInstructionView,
  type MedicationPlansQuery,
  type MedicationPlanView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import {
  dateOnly,
  dateOnlyOrNull,
  isoOrNull,
  num,
  provenance,
  strength,
} from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import type {
  ClinicianProfile,
  Medication,
  MedicationInstruction,
  MedicationPlan,
  PatientProfile,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { toPlanView } from './plan-view.js';
import { PrescribingController } from './prescribing.controller.js';

export { SYNTHETIC_PLAN_NOTICE } from './plan-view.js';


@ApiTags('medications')
@Controller({ version: '1' })
export class MedicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('medications')
  @ApiOperation({ summary: 'Medication catalogue (global reference data)' })
  async catalogue(
    @Query(zod(MedicationCatalogueQuerySchema)) query: MedicationCatalogueQuery,
  ): Promise<MedicationCatalogueItem[]> {
    const rows = await this.prisma.db.medication.findMany({
      where: {
        isActive: true,
        ...(query.query ? { genericName: { contains: query.query, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ genericName: 'asc' }, { strengthValue: 'asc' }],
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      genericName: row.genericName,
      strength: strength(row),
      form: row.form,
      defaultRoute: row.defaultRoute,
    }));
  }

  @Get('patients/:patientId/medication-plans')
  @ApiOperation({
    summary: 'Signed medication plans with the reviewed instruction in the chosen language',
  })
  async plans(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(MedicationPlansQuerySchema)) query: MedicationPlansQuery,
  ): Promise<MedicationPlanView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
    );
    const locale = query.locale ?? resolveLocale(patient.preferredLocale);
    const rows = await this.prisma.tenant(patient.organizationId).medicationPlan.findMany({
      where: {
        patientProfileId: patient.id,
        status:
          query.status === 'all'
            ? { notIn: ['DRAFT', 'ENTERED_IN_ERROR'] }
            : { in: ['ACTIVE', 'ON_HOLD', 'COMPLETED'] },
      },
      include: {
        medication: true,
        prescriber: true,
        instructions: { where: { status: 'APPROVED', locale } },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });
    return rows.map((row) => toPlanView(row, row.instructions[0] ?? null, patient));
  }
}

@Module({ controllers: [MedicationsController, PrescribingController] })
export class MedicationsModule {}
