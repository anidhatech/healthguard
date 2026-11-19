import { Global, Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { AbdmCrypto } from './abdm-crypto.js';
import { AbdmHttpClient } from './abdm-http.client.js';
import { AbdmSessionService } from './abdm-session.service.js';

/** How long a fetched ABDM certificate is trusted before it is read again. */
const CERTIFICATE_CACHE_MS = 6 * 60 * 60 * 1000;

export interface AbdmGateway {
  http: AbdmHttpClient;
  session: AbdmSessionService;
  crypto: AbdmCrypto;
}

/** `null` unless `ABDM_ADAPTER=sandbox`: nothing reaches ABDM by default. */
export const ABDM_GATEWAY = Symbol('ABDM_GATEWAY');

export function createAbdmGateway(
  config: AppConfig,
  deps: { fetch: typeof fetch; now: () => number; logger?: Pick<Logger, 'log' | 'warn'> },
): AbdmGateway | null {
  const env = config.env;
  if (env.ABDM_ADAPTER !== 'sandbox' || !env.ABDM_CLIENT_ID || !env.ABDM_CLIENT_SECRET) {
    return null;
  }
  const http = new AbdmHttpClient(
    {
      gatewayUrl: env.ABDM_GATEWAY_URL,
      abhaUrl: env.ABDM_ABHA_URL,
      cmId: env.ABDM_CM_ID,
      timeoutMs: env.ABDM_TIMEOUT_MS,
    },
    {
      fetch: deps.fetch,
      now: deps.now,
      log: (event, detail) =>
        event === 'abdm.failure'
          ? deps.logger?.warn({ event, ...detail })
          : deps.logger?.log({ event, ...detail }),
    },
  );
  const session = new AbdmSessionService(
    http,
    { clientId: env.ABDM_CLIENT_ID, clientSecret: env.ABDM_CLIENT_SECRET },
    deps.now,
  );
  const crypto = new AbdmCrypto(http, () => session.accessToken(), deps.now, CERTIFICATE_CACHE_MS);
  return { http, session, crypto };
}

/**
 * The real ABDM adapter (Milestone 1). Separate from the labelled simulation in
 * the interoperability module, which makes no network calls. ABDM time is
 * always real time, never the demo clock.
 */
@Global()
@Module({
  providers: [
    {
      provide: ABDM_GATEWAY,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): AbdmGateway | null =>
        createAbdmGateway(config, {
          fetch: globalThis.fetch,
          now: Date.now,
          logger: new Logger('ABDM'),
        }),
    },
  ],
  exports: [ABDM_GATEWAY],
})
export class AbdmModule {}
