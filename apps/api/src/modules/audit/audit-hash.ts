import { createHash } from 'node:crypto';
import { stableStringify } from '@healthguard/shared';
import type {
  AccessDecision,
  ActorType,
  AIAgent,
  AuditAction,
  AuditOutcome,
} from '../../generated/prisma/client.js';

/** The audited fields, in a fixed shape, so a row's hash can be re-computed. */
export interface AuditHashInput {
  id: string;
  organizationId: string | null;
  occurredAt: Date;
  actorType: ActorType;
  actorUserId: string | null;
  actorRoles: string[];
  aiAgent?: AIAgent | null;
  patientProfileId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  purposeCode: string | null;
  consentId?: string | null;
  decision: AccessDecision;
  decisionReason: string | null;
  outcome: AuditOutcome;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * SHA-256 over the canonical JSON of the event. Stored with the row; the
 * table is append-only, so a mismatch on re-computation means tampering.
 */
export function auditContentHash(event: AuditHashInput): string {
  return createHash('sha256')
    .update(
      stableStringify({
        ...event,
        aiAgent: event.aiAgent ?? null,
        consentId: event.consentId ?? null,
        occurredAt: event.occurredAt.toISOString(),
      }),
    )
    .digest('hex');
}
