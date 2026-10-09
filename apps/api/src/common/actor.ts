import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { MemberRole, SessionRole } from '@healthguard/shared';
import type { Request } from 'express';
import { Problems } from './problem.js';

/** Who is calling, resolved from the session on every request. */
export interface ActorContext {
  userId: string;
  sessionId: string;
  displayName: string;
  email: string | null;
  preferredLocale: string;
  authMethod: 'DEMO_QUICK_LOGIN' | 'PASSWORD' | 'OIDC';
  /** Roles in the active organization, plus PATIENT / PLATFORM_ADMIN when applicable. */
  roles: SessionRole[];
  activeOrganizationId: string | null;
  memberId: string | null;
  memberRoles: MemberRole[];
  clinicianId: string | null;
  /** The caller's own patient profiles (any organization). */
  patientProfileIds: string[];
  isPlatformAdmin: boolean;
}

export interface RequestMeta {
  requestId: string;
  ipHash: string | null;
  userAgentHash: string | null;
  purposeHeader: string | null;
}

export interface HealthGuardRequest extends Request {
  actor?: ActorContext;
  meta?: RequestMeta;
  tokenExpiresAt?: Date;
}

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<HealthGuardRequest>();
  if (!request.actor) throw Problems.unauthenticated();
  return request.actor;
});

export const CurrentMeta = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<HealthGuardRequest>();
  return (
    request.meta ?? { requestId: 'unknown', ipHash: null, userAgentHash: null, purposeHeader: null }
  );
});

export function requireOrganization(actor: ActorContext): string {
  if (!actor.activeOrganizationId) throw Problems.tenantRequired();
  return actor.activeOrganizationId;
}
