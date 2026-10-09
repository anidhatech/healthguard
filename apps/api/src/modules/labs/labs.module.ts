import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LabResultsQuerySchema,
  PatientIdParamsSchema,
  type LabResultsQuery,
  type LabResultView,
  type LabTestView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { iso, isoOrNull, num, provenance } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('labs')
@Controller({ version: '1' })
export class LabsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('lab-tests')
  @ApiOperation({ summary: 'Lab test catalogue with LOINC codes (reference data)' })
  async tests(): Promise<LabTestView[]> {
    const rows = await this.prisma.db.labTest.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      loincCode: row.loincCode,
      name: row.name,
      unit: row.unit,
      category: row.category,
    }));
  }

  @Get('patients/:patientId/lab-results')
  @ApiOperation({ summary: 'Lab results, newest first (optionally one test, e.g. ?test=HBA1C)' })
  async results(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Query(zod(LabResultsQuerySchema)) query: LabResultsQuery,
  ): Promise<LabResultView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'LABS',
      'LabResult',
    );
    const rows = await this.prisma.tenant(patient.organizationId).labResult.findMany({
      where: {
        patientProfileId: patient.id,
        recordStatus: 'ACTIVE',
        ...(query.test ? { labTest: { code: query.test } } : {}),
      },
      include: { labTest: true },
      orderBy: { effectiveAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      test: {
        id: row.labTest.id,
        code: row.labTest.code,
        loincCode: row.labTest.loincCode,
        name: row.labTest.name,
      },
      valueNumeric: num(row.valueNumeric),
      valueText: row.valueText,
      unit: row.unit,
      referenceLow: num(row.referenceLow),
      referenceHigh: num(row.referenceHigh),
      interpretation: row.interpretation,
      effectiveAt: iso(row.effectiveAt),
      issuedAt: isoOrNull(row.issuedAt),
      status: row.status,
      performingLab: row.performingLab,
    }));
  }
}

@Module({ controllers: [LabsController] })
export class LabsModule {}
