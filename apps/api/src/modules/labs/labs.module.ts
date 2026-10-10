import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConfirmExtractedValuesSchema,
  DocumentParamsSchema,
  type ConfirmExtractedValues,
  type DocumentParams,
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
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('labs')
@Controller({ version: '1' })
export class LabsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
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
      documentId: row.documentId,
      extractionConfidence: num(row.extractionConfidence),
      awaitingConfirmation:
        row.recordSource === 'DOCUMENT_EXTRACTION' && row.verification === 'UNVERIFIED',
    }));
  }

  @Post('patients/:patientId/documents/:documentId/confirm-values')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'The patient checks values read from their report; only confirmed values count in trends',
  })
  async confirmValues(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(DocumentParamsSchema)) params: DocumentParams,
    @Body(zod(ConfirmExtractedValuesSchema)) body: ConfirmExtractedValues,
  ): Promise<{ confirmed: number; reported: number; documentStatus: string }> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'LabResult');
    const patient = await this.prisma.db.patientProfile.findUniqueOrThrow({
      where: { id: params.patientId },
    });
    const db = this.prisma.tenant(patient.organizationId);
    const document = await db.document.findFirst({
      where: { id: params.documentId, patientProfileId: patient.id },
    });
    if (!document) throw Problems.notFound('document');
    const pending = await db.labResult.findMany({
      where: {
        documentId: document.id,
        recordSource: 'DOCUMENT_EXTRACTION',
        verification: 'UNVERIFIED',
        recordStatus: 'ACTIVE',
      },
      include: { labTest: true },
    });
    const pendingIds = new Set(pending.map((row) => row.id));
    for (const item of body.results) {
      if (!pendingIds.has(item.labResultId)) {
        throw Problems.conflict('A value is not from this report or was already checked.');
      }
    }
    const now = await this.clock.now(patient.timezone);
    const matches = body.results.filter((item) => item.decision === 'MATCHES_REPORT');
    const mismatches = body.results.filter((item) => item.decision === 'DOES_NOT_MATCH');
    await this.prisma.db.$transaction(async (tx) => {
      if (matches.length) {
        await tx.labResult.updateMany({
          where: { id: { in: matches.map((item) => item.labResultId) } },
          data: { verification: 'PATIENT_CONFIRMED', status: 'FINAL' },
        });
      }
      if (mismatches.length) {
        // Wrong readings are withdrawn, never silently edited; the care team re-checks the paper.
        await tx.labResult.updateMany({
          where: { id: { in: mismatches.map((item) => item.labResultId) } },
          data: { recordStatus: 'ENTERED_IN_ERROR' },
        });
        await tx.followUp.create({
          data: {
            organizationId: patient.organizationId,
            patientProfileId: patient.id,
            type: 'REVIEW',
            origin: 'PATIENT_REQUEST',
            reason: `Patient says ${mismatches.length} value(s) read from "${document.title}" do not match the paper report. Re-check the report.`,
            dueDate: new Date(`${await this.clock.today(patient.timezone)}T00:00:00Z`),
            status: 'DUE',
            createdByUserId: actor.userId,
          },
        });
      }
      const remaining = await tx.labResult.count({
        where: {
          documentId: document.id,
          verification: 'UNVERIFIED',
          recordStatus: 'ACTIVE',
        },
      });
      if (remaining === 0 && document.status === 'EXTRACTED') {
        await tx.document.update({ where: { id: document.id }, data: { status: 'VERIFIED' } });
      }
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'UPDATE',
      resourceType: 'Document',
      resourceId: document.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: {
        confirmed: matches.length,
        reportedWrong: mismatches.length,
        at: now.toISOString(),
      },
    });
    const fresh = await db.document.findFirstOrThrow({ where: { id: document.id } });
    return { confirmed: matches.length, reported: mismatches.length, documentStatus: fresh.status };
  }
}

@Module({ controllers: [LabsController] })
export class LabsModule {}
