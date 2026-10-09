import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  COOKIE_NAMES,
  DemoLoginRequestSchema,
  PasswordLoginRequestSchema,
  SwitchOrganizationRequestSchema,
  UpdateLocaleRequestSchema,
  type DemoLoginRequest,
  type PasswordLoginRequest,
  type SwitchOrganizationRequest,
  type UpdateLocaleRequest,
} from '@healthguard/shared';
import type { Response } from 'express';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type HealthGuardRequest,
  type RequestMeta,
} from '../../common/actor.js';
import { Public, RateLimit } from '../../common/decorators.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { AuthService, type IssuedSession } from './auth.service.js';
import { clearSessionCookies, setSessionCookies } from './cookies.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private respond(response: Response, issued: IssuedSession, includeBearer = false) {
    setSessionCookies(response, this.config, issued);
    return includeBearer && !this.config.isProduction
      ? { ...issued.view, accessToken: issued.accessToken }
      : issued.view;
  }

  @Public()
  @Get('demo-accounts')
  @ApiOperation({
    summary: 'DEMO/DEVELOPMENT: list synthetic demo accounts (empty when demo auth is off)',
  })
  demoAccounts() {
    return this.auth.demoAccounts();
  }

  @Public()
  @RateLimit('auth')
  @Post('demo-login')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'DEMO/DEVELOPMENT AUTHENTICATION: quick sign-in as a synthetic account. Not identity verification.',
  })
  async demoLogin(
    @Body(zod(DemoLoginRequestSchema)) body: DemoLoginRequest,
    @CurrentMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.auth.demoLogin(body.email, meta);
    return this.respond(response, issued, body.issueBearerToken === true);
  }

  @Public()
  @RateLimit('auth')
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email and password sign-in (with lockout after 5 failures)' })
  async login(
    @Body(zod(PasswordLoginRequestSchema)) body: PasswordLoginRequest,
    @CurrentMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(response, await this.auth.passwordLogin(body.email, body.password, meta));
  }

  @Public()
  @RateLimit('auth')
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(
    @Req() request: HealthGuardRequest,
    @CurrentMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = (request.cookies as Record<string, string | undefined>)[
      COOKIE_NAMES.refreshToken
    ];
    if (!token) throw Problems.sessionExpired();
    try {
      return this.respond(response, await this.auth.refresh(token, meta));
    } catch (error) {
      clearSessionCookies(response, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out and revoke the session' })
  async logout(
    @Req() request: HealthGuardRequest,
    @CurrentMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refresh = (request.cookies as Record<string, string | undefined>)[
      COOKIE_NAMES.refreshToken
    ];
    const sessionId = refresh ? await this.auth.sessionIdForRefreshToken(refresh) : null;
    await this.auth.logout(request.actor, sessionId, meta);
    clearSessionCookies(response, this.config);
  }

  @Get('me')
  @ApiOperation({ summary: 'The current session: user, roles, organizations, patient profiles' })
  me(@CurrentActor() actor: ActorContext, @Req() request: HealthGuardRequest) {
    return this.auth.view(actor, request.tokenExpiresAt ?? new Date());
  }

  @Post('switch-organization')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Switch the active organization (membership or patient profile required)',
  })
  async switchOrganization(
    @CurrentActor() actor: ActorContext,
    @Body(zod(SwitchOrganizationRequestSchema)) body: SwitchOrganizationRequest,
    @CurrentMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.auth.switchOrganization(actor, body.organizationId, meta);
    setSessionCookies(response, this.config, {
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.accessTokenExpiresAt,
    });
    return issued.view;
  }

  @Patch('me/locale')
  @HttpCode(204)
  @ApiOperation({ summary: 'Set the preferred language (en-IN, hi-IN, te-IN)' })
  async updateLocale(
    @CurrentActor() actor: ActorContext,
    @Body(zod(UpdateLocaleRequestSchema)) body: UpdateLocaleRequest,
  ): Promise<void> {
    await this.auth.updateLocale(actor, body.preferredLocale);
  }
}
