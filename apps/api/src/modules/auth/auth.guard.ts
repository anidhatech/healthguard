import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COOKIE_NAMES } from '@healthguard/shared';
import type { HealthGuardRequest } from '../../common/actor.js';
import { IS_PUBLIC } from '../../common/decorators.js';
import { Problems } from '../../common/problem.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

/**
 * Global guard: every route needs a valid session unless marked `@Public()`.
 * The token proves who is calling; roles, memberships and patient links are
 * re-read from the database (cached briefly) so revocation takes effect.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<HealthGuardRequest>();
    const header = request.header('authorization');
    const cookies = request.cookies as Record<string, string | undefined>;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : cookies[COOKIE_NAMES.accessToken];

    if (token) {
      const claims = await this.tokens.verify(token);
      if (claims) {
        const actor = await this.sessions.loadActor(claims.sessionId);
        if (actor && actor.userId === claims.userId) {
          request.actor = actor;
          request.tokenExpiresAt = claims.expiresAt;
        }
      }
    }
    if (isPublic) return true;
    if (!request.actor) throw token ? Problems.sessionExpired() : Problems.unauthenticated();
    return true;
  }
}
