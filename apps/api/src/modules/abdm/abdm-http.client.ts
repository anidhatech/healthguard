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

export interface AbdmBinaryResponse {
  status: number;
  bytes: Buffer;
  contentType: string | null;
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

/**
 * A validation refusal names the field it objects to and says why, with no
 * code and no `message`: `{ "loginId": "<why>", "timestamp": "<when>" }`
 * (observed in the sandbox, 2026-11-19 and 2026-11-20). The reasons are passed
 * on as they came.
 */
function validationMessage(source: unknown): string | null {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return null;
  const reasons = Object.entries(source as Record<string, unknown>)
    .filter(([key, value]) => key !== 'timestamp' && key !== 'code' && typeof value === 'string')
    .map(([, value]) => (value as string).trim())
    .filter((value) => value.length > 0);
  return reasons.length > 0 ? reasons.join(' ') : null;
}

/** A refusal often names its reason only in the body, under `error` or at the top level. */
export function readAbdmError(body: unknown): { code: string | null; message: string | null } {
  const nested = field(body, 'error');
  const source = typeof nested === 'object' && nested !== null ? nested : body;
  const message = field(source, 'message');
  return {
    code: normalizeAbdmCode(field(source, 'code')),
    message:
      typeof message === 'string' && message.length > 0 ? message : validationMessage(source),
  };
}

/** A body that is empty or not JSON reads as `null`, never as a thrown error. */
function parseJson(text: string): unknown {
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
    const { status, bytes, requestId } = await this.send(request, 'application/json');
    return { status, body: parseJson(bytes.toString('utf8')) as T | null, requestId };
  }

  /** For the few calls that answer with a file, such as the ABHA card image. */
  async requestBinary(request: AbdmRequest): Promise<AbdmBinaryResponse> {
    const { status, bytes, contentType, requestId } = await this.send(request, '*/*');
    return { status, bytes, contentType, requestId };
  }

  private async send(
    request: AbdmRequest,
    accept: string,
  ): Promise<{ status: number; bytes: Buffer; contentType: string | null; requestId: string }> {
    const requestId = randomUUID();
    const base = request.host === 'gateway' ? this.config.gatewayUrl : this.config.abhaUrl;
    const url = `${base.replace(/\/+$/, '')}${request.path}`;
    const headers: Record<string, string> = {
      'REQUEST-ID': requestId,
      // UTC, ISO 8601 with milliseconds and a trailing Z.
      TIMESTAMP: new Date(this.deps.now()).toISOString(),
      'X-CM-ID': this.config.cmId,
      Accept: accept,
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
    let bytes: Buffer;
    try {
      response = await this.deps.fetch(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      bytes = Buffer.from(await response.arrayBuffer());
    } catch {
      this.deps.log?.('abdm.failure', { ...call, status: 0 });
      throw new AbdmApiError(0, null, null, requestId, request.path);
    }

    if (!response.ok) {
      const { code, message } = readAbdmError(parseJson(bytes.toString('utf8')));
      this.deps.log?.('abdm.failure', { ...call, status: response.status, code });
      throw new AbdmApiError(response.status, code, message, requestId, request.path);
    }
    this.deps.log?.('abdm.response', { ...call, status: response.status });
    return {
      status: response.status,
      bytes,
      contentType: response.headers.get('content-type'),
      requestId,
    };
  }
}
