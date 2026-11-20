/**
 * Shared by the interactive sandbox run scripts: hidden prompts, and printing
 * of request ids and response SHAPES (key names and value types) only, so a
 * tester can paste the output without exposing an identifier, a token or an OTP.
 */
import { createInterface, type Interface } from 'node:readline';
import { Writable } from 'node:stream';
import { buildConfig } from '../../config/env.js';
import { loadRootEnv } from '../../config/load-env.js';
import { AbdmApiError } from './abdm-http.client.js';
import { createAbdmGateway, type AbdmGateway } from './abdm.module.js';

export const print = (line = '') => process.stdout.write(`${line}\n`);

/** Keys whose values are ABDM's own wording, flags or method names, safe to show as they came. */
const SHOW_VALUE = new Set([
  'message',
  'isNew',
  'authResult',
  'code',
  'abhaStatus',
  'abhaType',
  'error',
  'timestamp',
  'authMethods',
  'status',
  'kycVerified',
  'mobileVerified',
]);

/** Key names and value types only: `string(12)`, `number`, `array(3) of string`. */
export function shape(value: unknown, key = ''): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (SHOW_VALUE.has(key) && value.every((item) => typeof item === 'string')) return value;
    return value.length === 0
      ? 'array(0)'
      : { [`array(${value.length}) of`]: shape(value[0] as unknown) };
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, item]) => [
        name,
        shape(item, name),
      ]),
    );
  }
  if (SHOW_VALUE.has(key)) return value;
  return typeof value === 'string' ? `string(${value.length})` : typeof value;
}

/**
 * A refusal's own words matter more than its shape, so its text fields are
 * shown, with every run of four or more digits masked in case it echoes an
 * identifier back.
 */
export function refusal(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return shape(value);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([name, item]) => [
      name,
      typeof item === 'string'
        ? item.replace(/[0-9]{4,}/g, (run) => 'X'.repeat(run.length))
        : shape(item, name),
    ]),
  );
}

let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk as Buffer);
    done();
  },
});
let terminal: Interface | null = null;

/**
 * Asks one question. The question is readline's own prompt, so the terminal
 * never erases it; for a hidden answer the echo is muted only after the
 * prompt has been written.
 */
export function ask(question: string, hidden = false): Promise<string> {
  terminal ??= createInterface({ input: process.stdin, output, terminal: true });
  const active = terminal;
  return new Promise((resolve) => {
    muted = false;
    active.question(question, (answer) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = hidden;
  });
}

export const yes = async (question: string) =>
  (await ask(`${question} Type y or n: `)).toLowerCase() === 'y';

export function closeTerminal(): void {
  terminal?.close();
  terminal = null;
}

/** Runs one call, printing a refusal with its request id instead of throwing. */
export async function step<T>(title: string, run: () => Promise<T>): Promise<T | null> {
  print(`\n== ${title}`);
  try {
    return await run();
  } catch (error) {
    if (error instanceof AbdmApiError) {
      print(
        `REFUSED status ${error.status} code ${error.code ?? 'none'} request ${error.requestId}`,
      );
      print(`ABDM message: ${error.abdmMessage ?? '(none)'}`);
    } else {
      print(`FAILED: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return null;
  }
}

/** A sandbox gateway that prints the shape of every answer as it arrives, before anything parses it. */
export function createObservedGateway(): AbdmGateway | null {
  loadRootEnv();
  const config = buildConfig({ ...process.env, ABDM_ADAPTER: 'sandbox', DEMO_MODE: 'false' });
  const observingFetch = (async (url: string | URL, init?: RequestInit) => {
    const response = await fetch(url, init);
    const path = new URL(url.toString()).pathname;
    const type = response.headers.get('content-type') ?? '';
    if (path.endsWith('/sessions') || path.endsWith('/public/certificate')) return response;
    if (type.includes('json')) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      print(`response ${response.status} ${path}`);
      print(JSON.stringify(response.ok ? shape(body) : refusal(body), null, 2));
    } else {
      print(`response ${response.status} ${path} content-type ${type || '(none)'}`);
    }
    return response;
  }) as typeof fetch;
  const gateway = createAbdmGateway(config, {
    fetch: observingFetch,
    now: Date.now,
    logger: {
      log: (detail: unknown) => print(JSON.stringify(detail)),
      warn: (detail: unknown) => print(JSON.stringify(detail)),
    },
  });
  if (!gateway) print('Set ABDM_CLIENT_ID and ABDM_CLIENT_SECRET in .env first.');
  return gateway;
}
