import { AbdmApiError, type AbdmHttpClient } from './abdm-http.client.js';

export const GATEWAY_SESSION_PATH = '/api/hiecm/gateway/v3/sessions';

interface SessionResponse {
  accessToken?: unknown;
  expiresIn?: unknown;
}

export interface AbdmSessionConfig {
  clientId: string;
  clientSecret: string;
}

/** Renew this long before `expiresIn` runs out, never on a fixed timer. */
const RENEW_MARGIN_MS = 60_000;
/** After a refusal, wait before asking again: a credential check is never looped. */
const FAILURE_BACKOFF_MS = 30_000;

/**
 * The gateway session token every other ABDM call carries. It says which
 * application is calling, not which person. Held in memory only.
 */
export class AbdmSessionService {
  private token: { value: string; renewAt: number } | null = null;
  private pending: Promise<string> | null = null;
  private failure: { error: AbdmApiError; retryAt: number } | null = null;

  constructor(
    private readonly http: AbdmHttpClient,
    private readonly config: AbdmSessionConfig,
    private readonly now: () => number,
  ) {}

  async accessToken(): Promise<string> {
    const at = this.now();
    if (this.token && at < this.token.renewAt) return this.token.value;
    if (this.failure && at < this.failure.retryAt) throw this.failure.error;
    this.pending ??= this.open().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** Drop the cached token, for a call that was refused as unauthorised. */
  invalidate(): void {
    this.token = null;
  }

  private async open(): Promise<string> {
    try {
      const { body, requestId } = await this.http.request<SessionResponse>({
        host: 'gateway',
        method: 'POST',
        path: GATEWAY_SESSION_PATH,
        body: {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          grantType: 'client_credentials',
        },
      });
      const value = body?.accessToken;
      const expiresIn = Number(body?.expiresIn);
      if (typeof value !== 'string' || value.length === 0 || !(expiresIn > 0)) {
        throw new AbdmApiError(
          200,
          null,
          'Session response carried no token',
          requestId,
          GATEWAY_SESSION_PATH,
        );
      }
      const lifetimeMs = expiresIn * 1000;
      this.token = {
        value,
        renewAt: this.now() + Math.max(lifetimeMs - RENEW_MARGIN_MS, lifetimeMs / 2),
      };
      this.failure = null;
      return value;
    } catch (error) {
      this.token = null;
      if (error instanceof AbdmApiError) {
        this.failure = { error, retryAt: this.now() + FAILURE_BACKOFF_MS };
      }
      throw error;
    }
  }
}
