import { randomUUID } from 'node:crypto';

/** Which ABDM service a call goes to. Hosts come from configuration, never from a sample. */
export type AbdmHost = 'gateway' | 'abha';

export interface AbdmHttpConfig {
  gatewayUrl: string;
  abhaUrl: string;
  /** Consent manager suffix sent as `X-CM-ID`: `sbx` in the sandbox. */
  cmId: string;
  timeoutMs: number;
}

export interface AbdmRequest {
  host: AbdmHost;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Gateway session token, sent as `Authorization: Bearer`. */
  accessToken?: string;
  /** User token from an enrolment or a login, sent as `X-token: Bearer`. */
  userToken?: string;
  headers?: Record<string, string>;
}

export interface AbdmResponse<T> {
  status: number;
  /** `null` when ABDM answered with no body. */
  body: T | null;
  /** The `REQUEST-ID` sent with the call: the only handle on it once it has failed. */
  requestId: string;
}

/** What is safe to log about a call: never a body, a token or an identifier. */
export interface AbdmCallLog {
  requestId: string;
  host: AbdmHost;
  method: string;
  path: string;
  status?: number;
  code?: string | null;
}

export interface AbdmHttpDeps {
  fetch: typeof fetch;
  now: () => number;
  log?: (event: 'abdm.request' | 'abdm.response' | 'abdm.failure', detail: AbdmCallLog) => void;
}

/**
 * ABDM returns a code bare (`ABDM-1017`) or with a trailing separator
 * (`ABDM-1017: `), so codes are normalized before anything compares them.
 */
export function normalizeAbdmCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const code = String(value)
    .trim()
    .replace(/[\s:]+$/, '');
  return code.length > 0 ? code : null;
}

function field(source: unknown, key: string): unknown {
  return typeof source === 'object' && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;
}

/** A refusal often names its reason only in the body, under `error` or at the top level. */
export function readAbdmError(body: unknown): { code: string | null; message: string | null } {
  const nested = field(body, 'error');
  const source = typeof nested === 'object' && nested !== null ? nested : body;
  const message = field(source, 'message');
  return {
    code: normalizeAbdmCode(field(source, 'code')),
    message: typeof message === 'string' && message.length > 0 ? message : null,
  };
}

/** A call ABDM refused, or one that never got an answer (`status` 0). */
export class AbdmApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly abdmMessage: string | null,
    readonly requestId: string,
    readonly path: string,
  ) {
    super(
      `ABDM call failed: ${path} status ${status}${code ? ` code ${code}` : ''} request ${requestId}`,
    );
    this.name = 'AbdmApiError';
  }

  is(code: string): boolean {
    return this.code === normalizeAbdmCode(code);
  }
}

/** The one outbound client for every ABDM host. It never retries and never logs a body. */
export class AbdmHttpClient {
  constructor(
    private readonly config: AbdmHttpConfig,
    private readonly deps: AbdmHttpDeps,
  ) {}

  async request<T>(request: AbdmRequest): Promise<AbdmResponse<T>> {
    const requestId = randomUUID();
    const base = request.host === 'gateway' ? this.config.gatewayUrl : this.config.abhaUrl;
    const url = `${base.replace(/\/+$/, '')}${request.path}`;
    const headers: Record<string, string> = {
      'REQUEST-ID': requestId,
      // UTC, ISO 8601 with milliseconds and a trailing Z.
      TIMESTAMP: new Date(this.deps.now()).toISOString(),
      'X-CM-ID': this.config.cmId,
      Accept: 'application/json',
      ...request.headers,
    };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    if (request.accessToken) headers.Authorization = `Bearer ${request.accessToken}`;
    if (request.userToken) headers['X-token'] = `Bearer ${request.userToken}`;

    const call: AbdmCallLog = {
      requestId,
      host: request.host,
      method: request.method,
      path: request.path,
    };
    // Logged before sending, so a call that never returns can still be traced.
    this.deps.log?.('abdm.request', call);

    let response: Response;
    let text: string;
    try {
      response = await this.deps.fetch(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      text = await response.text();
    } catch {
      this.deps.log?.('abdm.failure', { ...call, status: 0 });
      throw new AbdmApiError(0, null, null, requestId, request.path);
    }

    let body: unknown = null;
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const { code, message } = readAbdmError(body);
      this.deps.log?.('abdm.failure', { ...call, status: response.status, code });
      throw new AbdmApiError(response.status, code, message, requestId, request.path);
    }
    this.deps.log?.('abdm.response', { ...call, status: response.status });
    return { status: response.status, body: body as T | null, requestId };
  }
}
