import { API_BASE_PATH, COOKIE_NAMES } from '@healthguard/shared';
import type { CookieOptions, Response } from 'express';
import { randomToken } from '../../common/hashing.js';
import type { AppConfig } from '../../config/env.js';

const REFRESH_PATH = `${API_BASE_PATH}/auth`;

function base(config: AppConfig): CookieOptions {
  return { secure: config.cookieSecure, sameSite: 'lax', path: '/' };
}

/**
 * Access token: httpOnly, whole site. Refresh token: httpOnly, strict, only
 * sent to the auth endpoints. CSRF token: readable by the page, echoed in a
 * header. `hg_session` is a non-secret marker the web app uses for routing.
 */
export function setSessionCookies(
  response: Response,
  config: AppConfig,
  tokens: { accessToken: string; accessTokenExpiresAt: Date; refreshToken?: string },
): void {
  const refreshMaxAge = config.env.REFRESH_TOKEN_TTL_SECONDS * 1000;
  response.cookie(COOKIE_NAMES.accessToken, tokens.accessToken, {
    ...base(config),
    httpOnly: true,
    expires: tokens.accessTokenExpiresAt,
  });
  if (tokens.refreshToken) {
    response.cookie(COOKIE_NAMES.refreshToken, tokens.refreshToken, {
      ...base(config),
      httpOnly: true,
      sameSite: 'strict',
      path: REFRESH_PATH,
      maxAge: refreshMaxAge,
    });
    response.cookie(COOKIE_NAMES.csrf, randomToken(24), {
      ...base(config),
      httpOnly: false,
      maxAge: refreshMaxAge,
    });
    response.cookie(COOKIE_NAMES.session, '1', {
      ...base(config),
      httpOnly: false,
      maxAge: refreshMaxAge,
    });
  }
}

export function clearSessionCookies(response: Response, config: AppConfig): void {
  response.clearCookie(COOKIE_NAMES.accessToken, { ...base(config), httpOnly: true });
  response.clearCookie(COOKIE_NAMES.refreshToken, {
    ...base(config),
    httpOnly: true,
    sameSite: 'strict',
    path: REFRESH_PATH,
  });
  response.clearCookie(COOKIE_NAMES.csrf, base(config));
  response.clearCookie(COOKIE_NAMES.session, base(config));
}
