import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  COMING_NEXT_PHASE,
  PatientIdParamsSchema,
  type DocumentView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnlyOrNull, iso } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

/**
 * Document metadata. Upload, virus scanning, storage and AI extraction are
 * the next phase; seeded documents are synthetic samples with no file behind
 * them, and the API says so instead of offering a broken download.
 */
@ApiTags('files')
@Controller({ version: '1' })
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('patients/:patientId/documents')
  @ApiOperation({ summary: "A patient's documents (metadata only in this phase)" })
  async list(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<DocumentView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'DOCUMENTS',
      'Document',
    );
    const rows = await this.prisma.tenant(patient.organizationId).document.findMany({
      where: { patientProfileId: patient.id, deletedAt: null, recordStatus: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      type: row.type,
      title: row.title,
      documentDate: dateOnlyOrNull(row.documentDate),
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      status: row.status,
      isSyntheticSample: row.isSyntheticSample,
      createdAt: iso(row.createdAt),
      download: {
        available: false,
        note: row.isSyntheticSample
          ? 'Synthetic sample: metadata only, there is no file to download.'
          : `File storage: ${COMING_NEXT_PHASE}.`,
      },
    }));
  }
}

@Module({ controllers: [FilesController] })
export class FilesModule {}
