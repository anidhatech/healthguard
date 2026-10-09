import {
  API_BASE_PATH,
  COOKIE_NAMES,
  CSRF_HEADER,
  type ApiEnvelope,
  type ProblemDetails,
} from '@healthguard/shared';
import { readCookie } from './utils';

/** An API error carrying RFC 9457 problem details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Partial<ProblemDetails>,
  ) {
    super(problem.detail ?? problem.title ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }

  get code(): string | undefined {
    return this.problem.code;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE_PATH}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { [CSRF_HEADER]: readCookie(COOKIE_NAMES.csrf) ?? '' },
  })
    .then((response) => response.ok)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * Same-origin call to the API (forwarded by Next.js). Sends the CSRF token on
 * writes and refreshes an expired access token once. Returns `data` from the
 * `{ data, meta }` envelope.
 */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  retry = true,
): Promise<T> {
  const { json, headers, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...rest,
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { [CSRF_HEADER]: readCookie(COOKIE_NAMES.csrf) ?? '' } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, init, false);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as
    ApiEnvelope<T> | Partial<ProblemDetails>;
  if (!response.ok) throw new ApiError(response.status, body as Partial<ProblemDetails>);
  return (body as ApiEnvelope<T>).data;
}
