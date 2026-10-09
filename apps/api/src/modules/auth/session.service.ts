import { Inject, Injectable } from '@nestjs/common';
import type { MemberRole, SessionRole } from '@healthguard/shared';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import { randomToken, sha256 } from '../../common/hashing.js';
import { Problems } from '../../common/problem.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import type { AuthMethod } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const ACTOR_CACHE_MS = 30_000;

/**
 * Server-side sessions with rotating refresh tokens. Only hashes are stored.
 * Presenting an already-rotated refresh token revokes the whole session
 * (token theft detection).
 */
@Injectable()
export class SessionService {
  private readonly actorCache = new Map<string, { actor: ActorContext; loadedAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(
    userId: string,
    organizationId: string | null,
    authMethod: AuthMethod,
    meta: RequestMeta,
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const refreshToken = randomToken();
    const session = await this.prisma.db.authSession.create({
      data: {
        userId,
        activeOrganizationId: organizationId,
        refreshTokenHash: sha256(refreshToken),
        authMethod,
        expiresAt: new Date(Date.now() + this.config.env.REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgentHash: meta.userAgentHash,
        ipHash: meta.ipHash,
      },
    });
    return { sessionId: session.id, refreshToken };
  }

  async rotate(refreshToken: string, meta: RequestMeta) {
    const hash = sha256(refreshToken);
    const session = await this.prisma.db.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (!session) {
      const reused = await this.prisma.db.authSession.findUnique({
        where: { previousRefreshTokenHash: hash },
      });
      if (reused && !reused.revokedAt) {
        await this.revoke(reused.id);
        await this.audit.record({
          actor: null,
          meta,
          action: 'LOGOUT',
          resourceType: 'AuthSession',
          resourceId: reused.id,
          outcome: 'FAILURE',
          metadata: { reason: 'refresh-token-reuse' },
        });
      }
      throw Problems.sessionExpired();
    }
    if (session.revokedAt || session.expiresAt < new Date()) throw Problems.sessionExpired();
    const next = randomToken();
    const updated = await this.prisma.db.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(next),
        previousRefreshTokenHash: hash,
        lastUsedAt: new Date(),
      },
    });
    return { session: updated, refreshToken: next };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.actorCache.delete(sessionId);
  }

  async setActiveOrganization(sessionId: string, organizationId: string): Promise<void> {
    await this.prisma.db.authSession.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    });
    this.actorCache.delete(sessionId);
  }

  forget(sessionId: string): void {
    this.actorCache.delete(sessionId);
  }

  /** The default organization: the first active membership, else the first patient profile's. */
  async defaultOrganization(userId: string): Promise<string | null> {
    const membership = await this.prisma.db.organizationMember.findFirst({
      where: { userId, status: 'ACTIVE', deletedAt: null, organization: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
    });
    if (membership) return membership.organizationId;
    const profile = await this.prisma.db.patientProfile.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return profile?.organizationId ?? null;
  }

  /** Builds the caller's context from the database (cached briefly). */
  async loadActor(sessionId: string): Promise<ActorContext | null> {
    const cached = this.actorCache.get(sessionId);
    if (cached && Date.now() - cached.loadedAt < ACTOR_CACHE_MS) return cached.actor;

    const session = await this.prisma.db.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'ACTIVE', deletedAt: null },
              include: { clinicianProfile: true },
            },
            patientProfiles: {
              where: { deletedAt: null },
              select: { id: true, organizationId: true },
            },
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const user = session.user;
    if (user.status !== 'ACTIVE' || user.deletedAt) return null;

    const orgId = session.activeOrganizationId;
    const membership = user.memberships.find((member) => member.organizationId === orgId) ?? null;
    const memberRoles = (membership?.roles ?? []) as MemberRole[];
    const roles: SessionRole[] = [...memberRoles];
    if (user.patientProfiles.some((profile) => profile.organizationId === orgId))
      roles.push('PATIENT');
    if (user.platformRole === 'PLATFORM_ADMIN') roles.push('PLATFORM_ADMIN');

    const actor: ActorContext = {
      userId: user.id,
      sessionId: session.id,
      displayName: user.displayName,
      email: user.email,
      preferredLocale: user.preferredLocale,
      authMethod: session.authMethod,
      roles,
      activeOrganizationId: orgId,
      memberId: membership?.id ?? null,
      memberRoles,
      clinicianId: membership?.clinicianProfile?.id ?? null,
      patientProfileIds: user.patientProfiles.map((profile) => profile.id),
      isPlatformAdmin: user.platformRole === 'PLATFORM_ADMIN',
    };
    this.actorCache.set(sessionId, { actor, loadedAt: Date.now() });
    return actor;
  }
}
