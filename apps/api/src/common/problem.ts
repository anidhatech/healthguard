import { HttpException } from '@nestjs/common';
import type { AccessReason, ErrorCode } from '@healthguard/shared';

export interface ProblemOptions {
  detail?: string;
  reason?: string;
  errors?: { path: string; message: string }[];
}

/** An error rendered as RFC 9457 problem details with a stable code. */
export class ProblemException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: number,
    readonly title: string,
    readonly problem: ProblemOptions = {},
  ) {
    super({ code, title, ...problem }, status);
  }
}

export const Problems = {
  validation: (errors: { path: string; message: string }[]) =>
    new ProblemException('VALIDATION_FAILED', 400, 'The request is not valid', {
      detail: 'One or more fields failed validation.',
      errors,
    }),
  unauthenticated: (detail = 'Sign in to continue.') =>
    new ProblemException('UNAUTHENTICATED', 401, 'Not signed in', { detail }),
  invalidCredentials: () =>
    new ProblemException('INVALID_CREDENTIALS', 401, 'Sign-in failed', {
      detail: 'The email or password is not correct.',
    }),
  accountLocked: () =>
    new ProblemException('ACCOUNT_LOCKED', 423, 'Account temporarily locked', {
      detail: 'Too many failed attempts. Try again in 15 minutes.',
    }),
  sessionExpired: () =>
    new ProblemException('SESSION_EXPIRED', 401, 'Session expired', { detail: 'Sign in again.' }),
  csrf: () =>
    new ProblemException('CSRF_FAILED', 403, 'Request blocked', {
      detail: 'The CSRF token is missing or does not match.',
    }),
  forbidden: (detail = 'Your role does not allow this.') =>
    new ProblemException('FORBIDDEN', 403, 'Not allowed', { detail }),
  accessDenied: (reason: AccessReason, detail: string) =>
    new ProblemException('ACCESS_DENIED', 403, 'Access denied', { reason, detail }),
  notFound: (what = 'resource') =>
    new ProblemException('NOT_FOUND', 404, 'Not found', { detail: `The ${what} was not found.` }),
  conflict: (detail: string) => new ProblemException('CONFLICT', 409, 'Conflict', { detail }),
  rateLimited: () =>
    new ProblemException('RATE_LIMITED', 429, 'Too many requests', {
      detail: 'Slow down and try again in a minute.',
    }),
  demoAuthDisabled: () =>
    new ProblemException('DEMO_AUTH_DISABLED', 403, 'Demo sign-in is disabled', {
      detail: 'Demo quick sign-in is only available when DEMO_MODE is on.',
    }),
  tenantRequired: () =>
    new ProblemException('TENANT_CONTEXT_REQUIRED', 400, 'Organization required', {
      detail: 'Choose an organization first.',
    }),
  aiProhibited: (reason: string, detail: string) =>
    new ProblemException('AI_REQUEST_PROHIBITED', 422, 'AI request refused', { reason, detail }),
  aiNotAvailable: (detail: string) =>
    new ProblemException('AI_TASK_NOT_AVAILABLE', 422, 'AI task not available', { detail }),
  serviceUnavailable: (detail: string) =>
    new ProblemException('SERVICE_UNAVAILABLE', 503, 'Service unavailable', { detail }),
};
