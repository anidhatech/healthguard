/**
 * Sandbox smoke check for the ABDM adapter foundation: opens a gateway
 * session, reads the ABHA certificate and encrypts a throwaway value.
 * Prints request ids and shapes only, never a token, a key or a secret.
 *
 *   ABDM_ADAPTER=sandbox pnpm --filter @healthguard/api abdm:smoke
 */
import { buildConfig } from '../../config/env.js';
import { loadRootEnv } from '../../config/load-env.js';
import { AbdmApiError } from './abdm-http.client.js';
import { createAbdmGateway } from './abdm.module.js';

async function main(): Promise<number> {
  loadRootEnv();
  const config = buildConfig({ ...process.env, ABDM_ADAPTER: 'sandbox', DEMO_MODE: 'false' });
  const print = (line: string) => process.stdout.write(`${line}\n`);
  const gateway = createAbdmGateway(config, {
    fetch: globalThis.fetch,
    now: Date.now,
    logger: {
      log: (detail: unknown) => print(JSON.stringify(detail)),
      warn: (detail: unknown) => print(JSON.stringify(detail)),
    },
  });
  if (!gateway) {
    print('ABDM adapter is not configured');
    return 1;
  }
  try {
    const token = await gateway.session.accessToken();
    print(`session: token received (${token.split('.').length} parts, ${token.length} characters)`);
    const encrypted = await gateway.crypto.encrypt('000000');
    print(
      `certificate: read; encrypted a throwaway value to ${encrypted.length} base64 characters`,
    );
    return 0;
  } catch (error) {
    if (error instanceof AbdmApiError) {
      print(`refused: ${error.message}${error.abdmMessage ? ` (${error.abdmMessage})` : ''}`);
    } else {
      print(`failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return 1;
  }
}

process.exitCode = await main();
