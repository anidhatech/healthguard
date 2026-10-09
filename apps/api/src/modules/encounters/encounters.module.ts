import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PatientIdParamsSchema,
  type EncounterView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { isoOrNull, provenance } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('encounters')
@Controller({ version: '1' })
export class EncountersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('patients/:patientId/encounters')
  @ApiOperation({ summary: "A patient's visits, newest first" })
  async list(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<EncounterView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ENCOUNTERS',
      'Encounter',
    );
    const rows = await this.prisma.tenant(patient.organizationId).encounter.findMany({
      where: { patientProfileId: patient.id, recordStatus: 'ACTIVE' },
      include: { clinician: true },
      orderBy: { startedAt: 'desc' },
    });
    // Clinical notes are deliberately not returned in this phase.
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance({ ...row, verification: 'CLINICIAN_VERIFIED' }),
      type: row.type,
      status: row.status,
      reasonForVisit: row.reasonForVisit,
      startedAt: isoOrNull(row.startedAt),
      endedAt: isoOrNull(row.endedAt),
      clinician: { id: row.clinician.id, displayName: row.clinician.displayName },
    }));
  }
}

@Module({ controllers: [EncountersController] })
export class EncountersModule {}
