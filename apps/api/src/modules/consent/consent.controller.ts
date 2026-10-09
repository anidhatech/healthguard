import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IdParamsSchema,
  PatientIdParamsSchema,
  type ConsentPurposeView,
  type ConsentView,
  type PatientIdParams,
} from '@healthguard/shared';
import { z } from 'zod';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnlyOrNull, iso, isoOrNull } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from './patient-access.service.js';

const RevokeParamsSchema = PatientIdParamsSchema.extend({ consentId: IdParamsSchema.shape.id });

@ApiTags('consent')
@Controller({ version: '1' })
export class ConsentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
  ) {}

  @Get('consent-purposes')
  @ApiOperation({ summary: 'Consent purposes (reference data)' })
  async purposes(): Promise<ConsentPurposeView[]> {
    const rows = await this.prisma.db.consentPurpose.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      defaultCategories: row.defaultCategories,
      defaultDurationDays: row.defaultDurationDays,
      abdmPurposeCode: row.abdmPurposeCode,
    }));
  }

  @Get('patients/:patientId/consents')
  @ApiOperation({ summary: "A patient's consents (the patient, or staff who can see the patient)" })
  async list(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<ConsentView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'DEMOGRAPHICS',
      'Consent',
    );
    const rows = await this.prisma.tenant(patient.organizationId).consent.findMany({
      where: { patientProfileId: patient.id },
      include: {
        purpose: true,
        granteeClinician: true,
        patient: { include: { organization: true } },
      },
      orderBy: [{ status: 'asc' }, { validFrom: 'desc' }],
    });
    const now = new Date();
    return rows.map((row) => ({
      id: row.id,
      purpose: { code: row.purpose.code, name: row.purpose.name },
      grantee: {
        type: row.granteeType,
        displayName: row.granteeClinician?.displayName ?? row.patient.organization.name,
      },
      categories: row.categories,
      dataFrom: dateOnlyOrNull(row.dataFrom),
      dataTo: dateOnlyOrNull(row.dataTo),
      validFrom: iso(row.validFrom),
      validUntil: iso(row.validUntil),
      status: row.status,
      method: row.method,
      decidedAt: isoOrNull(row.decidedAt),
      revokedAt: isoOrNull(row.revokedAt),
      noticeVersion: row.noticeVersion,
      noticeLocale: row.noticeLocale,
      isActiveNow: row.status === 'GRANTED' && row.validFrom <= now && row.validUntil > now,
    }));
  }

  @Post('patients/:patientId/consents/:consentId/revoke')
  @HttpCode(200)
  @ApiOperation({
    summary: 'The patient withdraws a consent. Takes effect immediately and is audited.',
  })
  async revoke(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(RevokeParamsSchema)) params: z.infer<typeof RevokeParamsSchema>,
  ): Promise<{ id: string; status: 'REVOKED'; revokedAt: string }> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'Consent');
    const patient = await this.prisma.db.patientProfile.findUnique({
      where: { id: params.patientId },
    });
    if (!patient) throw Problems.notFound('patient');
    const scoped = this.prisma.tenant(patient.organizationId);
    const consent = await scoped.consent.findFirst({
      where: { id: params.consentId, patientProfileId: patient.id },
    });
    if (!consent) throw Problems.notFound('consent');
    if (consent.status !== 'GRANTED')
      throw Problems.conflict('Only an active consent can be withdrawn.');
    const revokedAt = new Date();
    await scoped.consent.update({
      where: { id: consent.id },
      data: { status: 'REVOKED', revokedAt, revokedReason: 'Withdrawn by the patient in the app' },
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CONSENT_REVOKE',
      resourceType: 'Consent',
      resourceId: consent.id,
      patientProfileId: patient.id,
      consentId: consent.id,
    });
    return { id: consent.id, status: 'REVOKED', revokedAt: revokedAt.toISOString() };
  }
}
