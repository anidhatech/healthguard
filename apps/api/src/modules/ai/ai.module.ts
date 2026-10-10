import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AiRequestBodySchema,
  IdParamsSchema,
  PatientIdParamsSchema,
  ReviewRecommendationSchema,
  type ReviewRecommendation,
  type AiInteractionDetails,
  type AiRequestBody,
  type AiResultView,
  type AiStatus,
  type IdParams,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { RateLimit, Roles } from '../../common/decorators.js';
import { iso, isoOrNull } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ActivityModule } from '../activity/activity.module.js';
import { AdherenceModule } from '../adherence/adherence.module.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { AiService } from './ai.service.js';
import { FactSheetService } from './fact-sheet.service.js';

@ApiTags('ai')
@Controller({ version: '1' })
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
  ) {}

  @Get('ai/status')
  @ApiOperation({
    summary: 'AI provider, fallback, implemented / planned / prohibited tasks (never the key)',
  })
  status(): Promise<AiStatus> {
    return this.ai.status();
  }

  @Post('ai/recommendations/:id/review')
  @HttpCode(200)
  @Roles('DOCTOR')
  @ApiOperation({
    summary:
      'The doctor marks an AI observation as noted or dismissed. Nothing clinical happens automatically.',
  })
  async review(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(IdParamsSchema)) params: IdParams,
    @Body(zod(ReviewRecommendationSchema)) body: ReviewRecommendation,
  ): Promise<{ id: string; status: string; reviewedAt: string | null }> {
    const organizationId = requireOrganization(actor);
    const db = this.prisma.tenant(organizationId);
    const row = await db.aIRecommendation.findFirst({
      where: { id: params.id },
      include: { aiInteraction: { select: { actorUserId: true } } },
    });
    if (!row) throw Problems.notFound('AI observation');
    await this.patientAccess.authorize(
      actor,
      meta,
      row.patientProfileId,
      'CARE_PLAN',
      'AIRecommendation',
      'UPDATE',
    );
    if (row.status !== 'PROPOSED')
      throw Problems.conflict('This observation was already reviewed.');
    const now = new Date();
    const status = row.expiresAt && row.expiresAt < now ? 'EXPIRED' : body.decision;
    if (status === 'EXPIRED') {
      await db.aIRecommendation.update({ where: { id: row.id }, data: { status } });
      throw Problems.conflict('This observation expired. Run a new summary.');
    }
    const updated = await db.aIRecommendation.update({
      where: { id: row.id },
      data: {
        status,
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        reviewNote: body.reason ?? null,
      },
    });
    await this.audit.record({
      actor,
      meta,
      action: 'AI_RECOMMENDATION_REVIEWED',
      resourceType: 'AIRecommendation',
      resourceId: row.id,
      patientProfileId: row.patientProfileId,
      decision: 'ALLOW',
      metadata: { decision: body.decision, reason: body.reason ?? null, type: row.type },
    });
    return { id: updated.id, status: updated.status, reviewedAt: isoOrNull(updated.reviewedAt) };
  }

  @Post('patients/:patientId/ai/requests')
  @HttpCode(200)
  @Roles('DOCTOR')
  @RateLimit('ai')
  @ApiOperation({
    summary:
      'Run an AI task for a patient. Only DOCTOR_BRIEF_SYNTHESIS is available. Prohibited tasks (diagnose, prescribe, change dose, stop medication, …) are refused with 422.',
  })
  request(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Body(zod(AiRequestBodySchema)) body: AiRequestBody,
  ): Promise<AiResultView> {
    return this.ai.request(actor, meta, params.patientId, body);
  }

  @Get('ai/interactions/:id')
  @Roles('DOCTOR', 'ORG_ADMIN', 'AUDITOR')
  @ApiOperation({
    summary: 'Metadata of one AI interaction in the organization (for review and audit)',
  })
  async interaction(
    @CurrentActor() actor: ActorContext,
    @Param(zod(IdParamsSchema)) params: IdParams,
  ): Promise<AiInteractionDetails> {
    const organizationId = requireOrganization(actor);
    const row = await this.prisma
      .tenant(organizationId)
      .aIInteraction.findFirst({ where: { id: params.id } });
    if (!row) throw Problems.notFound('AI interaction');
    if (
      actor.memberRoles.includes('DOCTOR') &&
      !actor.memberRoles.includes('ORG_ADMIN') &&
      row.actorUserId !== actor.userId
    ) {
      throw Problems.notFound('AI interaction');
    }
    return {
      id: row.id,
      task: row.task,
      agent: row.agent,
      status: row.status,
      provider: row.provider,
      model: row.model,
      promptKey: row.promptKey,
      promptVersion: row.promptVersion,
      promptHash: row.promptHash,
      inputFactCount: row.inputFactIds.length,
      cached: row.cached,
      latencyMs: row.latencyMs,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      confidence: row.confidence,
      fallbackReason: row.fallbackReason,
      validation: row.validation,
      createdAt: iso(row.createdAt),
      completedAt: isoOrNull(row.completedAt),
    };
  }
}

@Module({
  imports: [ActivityModule, AdherenceModule],
  controllers: [AiController],
  providers: [AiService, FactSheetService],
})
export class AiModule {}
