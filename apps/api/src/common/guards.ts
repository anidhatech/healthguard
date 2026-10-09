import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  COOKIE_NAMES,
  CSRF_HEADER,
  satisfiesAnyRole,
  type RoleRequirement,
} from '@healthguard/shared';
import { timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { RedisService } from '../infrastructure/redis/redis.service.js';
import type { HealthGuardRequest } from './actor.js';
import { IS_PUBLIC, RATE_LIMIT_BUCKET, ROLES, type RateLimitBucket } from './decorators.js';
import { Problems } from './problem.js';

/** `@Roles(...)`: the session must hold one of the roles (CARE_TEAM expands). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleRequirement[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const actor = context.switchToHttp().getRequest<HealthGuardRequest>().actor;
    if (!actor) throw Problems.unauthenticated();
    if (!satisfiesAnyRole(actor.roles, required)) {
      throw Problems.forbidden(`This needs one of these roles: ${required.join(', ')}.`);
    }
    return true;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check for cookie-authenticated unsafe requests. Bearer
 * tokens (development tools) are not sent automatically by browsers, so they
 * are exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HealthGuardRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.header('authorization')?.startsWith('Bearer ')) return true;
    const cookies = request.cookies as Record<string, string | undefined>;
    const hasSessionCookie = Boolean(
      cookies[COOKIE_NAMES.accessToken] ?? cookies[COOKIE_NAMES.refreshToken],
    );
    if (!hasSessionCookie) return true;
    const cookie = cookies[COOKIE_NAMES.csrf];
    const header = request.header(CSRF_HEADER);
    if (!cookie || !header || cookie.length !== header.length) throw Problems.csrf();
    if (!timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) throw Problems.csrf();
    return true;
  }
}

/**
 * Fixed-window rate limits in Redis, per user when signed in, otherwise per
 * hashed IP. Fails open if Redis is down (readiness reports it).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const bucket =
      this.reflector.getAllAndOverride<RateLimitBucket | undefined>(RATE_LIMIT_BUCKET, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'default';
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<HealthGuardRequest>();
    if (isPublic && bucket === 'default' && /^\/(health|ready)/.test(request.path)) return true;
    const limit =
      bucket === 'auth'
        ? this.config.env.AUTH_RATE_LIMIT_PER_MINUTE
        : bucket === 'ai'
          ? this.config.env.AI_RATE_LIMIT_PER_MINUTE
          : this.config.env.RATE_LIMIT_PER_MINUTE;
    const subject = request.actor?.userId ?? request.meta?.ipHash ?? 'anonymous';
    const window = Math.floor(Date.now() / 60_000);
    const count = await this.redis.incrementWindow(`rl:${bucket}:${subject}:${window}`, 61);
    if (count !== null && count > limit) throw Problems.rateLimited();
    return true;
  }
}
