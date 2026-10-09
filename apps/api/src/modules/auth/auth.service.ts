import { Inject, Injectable } from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import {
  DEMO_ACCOUNTS,
  DEMO_AUTH_NOTICE,
  findDemoAccount,
  homeAreaForRoles,
  isMemberRole,
  resolveLocale,
  type DemoAccountsResponse,
  type OrganizationRef,
  type SessionView,
} from '@healthguard/shared';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import { sha256 } from '../../common/hashing.js';
import { patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import type { AuthMethod, Organization } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface IssuedSession {
  view: SessionView;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

function orgRef(org: Organization): OrganizationRef {
  return { id: org.id, name: org.name, slug: org.slug, type: org.type, isDemo: org.isDemo };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  demoAccounts(): DemoAccountsResponse {
    return {
      enabled: this.config.demoAuthEnabled,
      notice: DEMO_AUTH_NOTICE,
      passwordLoginEnabled: this.config.passwordLoginEnabled,
      accounts: this.config.demoAuthEnabled ? DEMO_ACCOUNTS.map((account) => ({ ...account })) : [],
    };
  }

  /** DEMO / DEVELOPMENT ONLY: signs in as a seeded synthetic account without a password. */
  async demoLogin(email: string, meta: RequestMeta): Promise<IssuedSession> {
    if (!this.config.demoAuthEnabled) throw Problems.demoAuthDisabled();
    const account = findDemoAccount(email);
    const user = account
      ? await this.prisma.db.user.findUnique({ where: { email: account.email } })
      : null;
    if (!account || !user || user.status !== 'ACTIVE') {
      await this.audit.record({
        actor: null,
        meta,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        metadata: { method: 'DEMO_QUICK_LOGIN' },
      });
      throw Problems.invalidCredentials();
    }
    return this.startSession(user.id, 'DEMO_QUICK_LOGIN', meta);
  }

  async passwordLogin(email: string, password: string, meta: RequestMeta): Promise<IssuedSession> {
    if (!this.config.passwordLoginEnabled)
      throw Problems.forbidden('Password sign-in is disabled.');
    const user = await this.prisma.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user?.lockedUntil && user.lockedUntil > new Date()) throw Problems.accountLocked();
    const valid =
      Boolean(user?.passwordHash) &&
      (await verify(user?.passwordHash ?? '', password).catch(() => false));
    if (!user || !valid || user.status !== 'ACTIVE') {
      if (user) {
        const failed = user.failedLoginCount + 1;
        await this.prisma.db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
            lockedUntil:
              failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          },
        });
      }
      await this.audit.record({
        actor: null,
        meta,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user?.id ?? null,
        metadata: { method: 'PASSWORD' },
      });
      throw Problems.invalidCredentials();
    }
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return this.startSession(user.id, 'PASSWORD', meta);
  }

  private async startSession(
    userId: string,
    method: AuthMethod,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const organizationId = await this.sessions.defaultOrganization(userId);
    const { sessionId, refreshToken } = await this.sessions.create(
      userId,
      organizationId,
      method,
      meta,
    );
    await this.prisma.db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    const actor = await this.sessions.loadActor(sessionId);
    if (!actor) throw Problems.sessionExpired();
    await this.audit.record({
      actor,
      meta,
      action: 'LOGIN',
      resourceType: 'AuthSession',
      resourceId: sessionId,
      metadata: { method },
    });
    return this.issue(actor, refreshToken);
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<IssuedSession> {
    const { session, refreshToken: next } = await this.sessions.rotate(refreshToken, meta);
    this.sessions.forget(session.id);
    const actor = await this.sessions.loadActor(session.id);
    if (!actor) throw Problems.sessionExpired();
    return this.issue(actor, next);
  }

  async logout(
    actor: ActorContext | undefined,
    refreshSessionId: string | null,
    meta: RequestMeta,
  ): Promise<void> {
    const sessionId = actor?.sessionId ?? refreshSessionId;
    if (!sessionId) return;
    await this.sessions.revoke(sessionId);
    await this.audit.record({
      actor: actor ?? null,
      meta,
      action: 'LOGOUT',
      resourceType: 'AuthSession',
      resourceId: sessionId,
    });
  }

  async sessionIdForRefreshToken(refreshToken: string): Promise<string | null> {
    const session = await this.prisma.db.authSession.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
    });
    return session?.id ?? null;
  }

  async switchOrganization(
    actor: ActorContext,
    organizationId: string,
    meta: RequestMeta,
  ): Promise<IssuedSession & { rotated: false }> {
    const [membership, profile] = await Promise.all([
      this.prisma.db.organizationMember.findFirst({
        where: { userId: actor.userId, organizationId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.db.patientProfile.findFirst({
        where: { userId: actor.userId, organizationId, deletedAt: null },
      }),
    ]);
    if (!membership && !profile) throw Problems.notFound('organization');
    await this.sessions.setActiveOrganization(actor.sessionId, organizationId);
    const updated = await this.sessions.loadActor(actor.sessionId);
    if (!updated) throw Problems.sessionExpired();
    await this.audit.record({
      actor: updated,
      meta,
      action: 'ORG_SWITCH',
      resourceType: 'Organization',
      resourceId: organizationId,
    });
    const access = await this.tokens.sign({
      userId: updated.userId,
      sessionId: updated.sessionId,
      organizationId,
      authMethod: updated.authMethod,
    });
    return {
      view: await this.view(updated, access.expiresAt),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: '',
      rotated: false,
    };
  }

  async updateLocale(actor: ActorContext, locale: string): Promise<void> {
    await this.prisma.db.user.update({
      where: { id: actor.userId },
      data: { preferredLocale: resolveLocale(locale) },
    });
    this.sessions.forget(actor.sessionId);
  }

  private async issue(actor: ActorContext, refreshToken: string): Promise<IssuedSession> {
    const access = await this.tokens.sign({
      userId: actor.userId,
      sessionId: actor.sessionId,
      organizationId: actor.activeOrganizationId,
      authMethod: actor.authMethod,
    });
    return {
      view: await this.view(actor, access.expiresAt),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
    };
  }

  async view(actor: ActorContext, accessTokenExpiresAt: Date): Promise<SessionView> {
    const [memberships, profiles, active] = await Promise.all([
      this.prisma.db.organizationMember.findMany({
        where: { userId: actor.userId, status: 'ACTIVE', deletedAt: null },
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.patientProfile.findMany({
        where: { userId: actor.userId, deletedAt: null },
        include: { organization: true },
      }),
      actor.activeOrganizationId
        ? this.prisma.db.organization.findUnique({ where: { id: actor.activeOrganizationId } })
        : Promise.resolve(null),
    ]);
    return {
      user: {
        id: actor.userId,
        email: actor.email,
        displayName: actor.displayName,
        preferredLocale: resolveLocale(actor.preferredLocale),
      },
      roles: actor.roles,
      activeOrganization: active ? orgRef(active) : null,
      memberships: memberships.map((member) => ({
        organization: orgRef(member.organization),
        roles: member.roles.filter(isMemberRole),
      })),
      patientProfiles: profiles.map((profile) => ({
        id: profile.id,
        displayName: patientDisplayName(profile),
        organization: orgRef(profile.organization),
      })),
      homeArea: homeAreaForRoles(actor.roles),
      authMethod: actor.authMethod,
      demoMode: this.config.demoMode,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }
}
