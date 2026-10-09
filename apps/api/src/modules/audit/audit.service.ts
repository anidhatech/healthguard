import { randomUUID } from 'node:crypto';
import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import type {
  AccessDecision,
  AIAgent,
  AuditAction,
  AuditOutcome,
  Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { auditContentHash } from './audit-hash.js';

export interface AuditRecord {
  actor: ActorContext | null;
  meta?: RequestMeta;
  organizationId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  patientProfileId?: string | null;
  purposeCode?: string | null;
  consentId?: string | null;
  decision?: AccessDecision;
  decisionReason?: string | null;
  outcome?: AuditOutcome;
  aiAgent?: AIAgent | null;
  /** Never put health data or secrets here: IDs, codes and counts only. */
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail. Every access decision (allow and deny), sign-in,
 * consent change and AI call is recorded. The database rejects updates and
 * deletes on this table.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditRecord): Promise<void> {
    const row = {
      id: randomUUID(),
      organizationId: event.organizationId ?? event.actor?.activeOrganizationId ?? null,
      occurredAt: new Date(),
      actorType: event.aiAgent
        ? ('AI_AGENT' as const)
        : event.actor
          ? ('USER' as const)
          : ('SYSTEM' as const),
      actorUserId: event.actor?.userId ?? null,
      actorRoles: event.actor?.roles ?? [],
      aiAgent: event.aiAgent ?? null,
      patientProfileId: event.patientProfileId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      purposeCode: event.purposeCode ?? null,
      consentId: event.consentId ?? null,
      decision: event.decision ?? 'NOT_APPLICABLE',
      decisionReason: event.decisionReason ?? null,
      outcome: event.outcome ?? (event.decision === 'DENY' ? 'FAILURE' : 'SUCCESS'),
      requestId: event.meta?.requestId ?? null,
      metadata: event.metadata ?? {},
    };
    try {
      await this.prisma.db.auditEvent.create({
        data: {
          ...row,
          ipHash: event.meta?.ipHash ?? null,
          userAgentHash: event.meta?.userAgentHash ?? null,
          metadata: row.metadata as Prisma.InputJsonValue,
          contentHash: auditContentHash(row),
        },
      });
    } catch (error) {
      // An audit failure must be visible to operators; the caller's response still goes out.
      this.logger.error({ err: error, action: event.action }, 'Failed to write audit event');
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditCoreModule {}
