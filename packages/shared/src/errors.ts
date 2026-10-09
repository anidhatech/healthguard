import { z } from 'zod';

/** Stable machine-readable error codes. The UI and tests rely on these. */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'SESSION_EXPIRED',
  'CSRF_FAILED',
  'FORBIDDEN',
  'ACCESS_DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DEMO_AUTH_DISABLED',
  'TENANT_CONTEXT_REQUIRED',
  'AI_REQUEST_PROHIBITED',
  'AI_TASK_NOT_AVAILABLE',
  'NOT_IMPLEMENTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** RFC 9457 problem details, extended with a stable code and the request ID. */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.enum(ERROR_CODES),
  requestId: z.string().optional(),
  reason: z.string().optional(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PROBLEM_TYPE_BASE = 'https://healthguard.example/problems/';

export function problemType(code: ErrorCode): string {
  return `${PROBLEM_TYPE_BASE}${code.toLowerCase().replaceAll('_', '-')}`;
}
