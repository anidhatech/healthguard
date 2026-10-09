import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuditEventsQuerySchema,
  PatientIdParamsSchema,
  type AccessLogEntry,
  type AuditEventsQuery,
  type AuditEventView,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { iso } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import type { AuditAction } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('audit')
@Controller({ version: '1' })
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('audit-events')
  @Roles('ORG_ADMIN', 'AUDITOR')
  @ApiOperation({
    summary: "The organization's audit trail (admins and auditors; no health data in rows)",
  })
  async list(
    @CurrentActor() actor: ActorContext,
    @Query(zod(AuditEventsQuerySchema)) query: AuditEventsQuery,
  ): Promise<AuditEventView[]> {
    const organizationId = requireOrganization(actor);
    const rows = await this.prisma.db.auditEvent.findMany({
      where: { organizationId, ...(query.action ? { action: query.action as AuditAction } : {}) },
      orderBy: { occurredAt: 'desc' },
      take: query.limit,
    });
    const users = await this.prisma.db.user.findMany({
      where: {
        id: { in: rows.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)) },
      },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return rows.map((row) => ({
      id: row.id,
      occurredAt: iso(row.occurredAt),
      actorType: row.actorType,
      actorUserId: row.actorUserId,
      actorDisplayName: row.actorUserId ? (names.get(row.actorUserId) ?? null) : null,
      actorRoles: row.actorRoles,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      patientProfileId: row.patientProfileId,
      purposeCode: row.purposeCode,
      decision: row.decision,
      decisionReason: row.decisionReason,
      outcome: row.outcome,
      requestId: row.requestId,
    }));
  }

  @Get('patients/:patientId/access-log')
  @ApiOperation({ summary: 'Who looked at my data: the patient sees every access to their record' })
  async accessLog(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AccessLogEntry[]> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'AccessLog');
    const patient = await this.prisma.db.patientProfile.findUniqueOrThrow({
      where: { id: params.patientId },
    });
    const rows = await this.prisma.db.auditEvent.findMany({
      where: {
        patientProfileId: patient.id,
        action: {
          in: [
            'READ',
            'ACCESS_DENIED',
            'EXPORT',
            'AI_INVOKE',
            'CONSENT_GRANT',
            'CONSENT_REVOKE',
            'BREAK_GLASS',
          ],
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    const users = await this.prisma.db.user.findMany({
      where: {
        id: { in: rows.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)) },
      },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return rows.map((row) => ({
      id: row.id,
      occurredAt: iso(row.occurredAt),
      actor: {
        type: row.actorType,
        displayName: row.actorUserId
          ? (names.get(row.actorUserId) ?? 'Unknown user')
          : row.aiAgent
            ? 'HealthGuard AI'
            : 'System',
        roles: row.actorRoles,
        sameOrganization: row.organizationId === patient.organizationId,
        isPatient: row.actorUserId === actor.userId,
      },
      action: row.action,
      resourceType: row.resourceType,
      purposeCode: row.purposeCode,
      decision: row.decision,
      decisionReason: row.decisionReason,
      outcome: row.outcome,
    }));
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
