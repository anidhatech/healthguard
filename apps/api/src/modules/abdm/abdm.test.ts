import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildConfig } from '../../config/env.js';
import {
  ABHA_CERTIFICATE_PATH,
  AbdmCrypto,
  AbdmCryptoError,
  resolvePadding,
} from './abdm-crypto.js';
import {
  AbdmApiError,
  AbdmHttpClient,
  normalizeAbdmCode,
  readAbdmError,
  type AbdmCallLog,
} from './abdm-http.client.js';
import { AbdmSessionService, GATEWAY_SESSION_PATH } from './abdm-session.service.js';
import { createAbdmGateway } from './abdm.module.js';

const CONFIG = {
  gatewayUrl: 'https://gateway.test/',
  abhaUrl: 'https://abha.test',
  cmId: 'sbx',
  timeoutMs: 5000,
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fetch stand-in that records each call and answers from a queue. */
function fakeFetch(answers: Array<{ status: number; body?: unknown; text?: string } | Error>) {
  const calls: Call[] = [];
  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    calls.push({
      url: url.toString(),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const answer = answers.shift();
    if (!answer) return Promise.reject(new Error('no answer queued'));
    if (answer instanceof Error) return Promise.reject(answer);
    const text = answer.text ?? (answer.body === undefined ? '' : JSON.stringify(answer.body));
    return Promise.resolve(new Response(text.length > 0 ? text : null, { status: answer.status }));
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function clock(start = Date.parse('2026-11-18T10:00:00.000Z')) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

describe('ABDM error codes', () => {
  it('reads a code bare or with a trailing separator', () => {
    expect(normalizeAbdmCode('ABDM-1017')).toBe('ABDM-1017');
    expect(normalizeAbdmCode('ABDM-1017: ')).toBe('ABDM-1017');
    expect(normalizeAbdmCode(900901)).toBe('900901');
    expect(normalizeAbdmCode('')).toBeNull();
    expect(normalizeAbdmCode(undefined)).toBeNull();
  });

  it('finds the code at the top level or under error', () => {
    expect(readAbdmError({ code: 'ABDM-1114: ', message: 'User not found.' })).toEqual({
      code: 'ABDM-1114',
      message: 'User not found.',
    });
    expect(readAbdmError({ error: { code: 'ABDM-1204', message: 'Invalid OTP' } })).toEqual({
      code: 'ABDM-1204',
      message: 'Invalid OTP',
    });
    expect(readAbdmError(null)).toEqual({ code: null, message: null });
  });
});

describe('AbdmHttpClient', () => {
  it('sends a fresh request id, a UTC timestamp and both tokens', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { status: 200, body: { ok: true } },
      { status: 200, body: {} },
    ]);
    const time = clock();
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: time.now });

    const first = await http.request<{ ok: boolean }>({
      host: 'abha',
      method: 'POST',
      path: '/abha/api/v3/profile/account',
      body: { a: 1 },
      accessToken: 'gateway-token',
      userToken: 'user-token',
    });
    await http.request({ host: 'gateway', method: 'GET', path: '/x' });

    expect(first.body).toEqual({ ok: true });
    expect(calls[0]?.url).toBe('https://abha.test/abha/api/v3/profile/account');
    expect(calls[1]?.url).toBe('https://gateway.test/x');
    const headers = calls[0]!.headers;
    expect(headers['REQUEST-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['REQUEST-ID']).toBe(first.requestId);
    expect(headers['REQUEST-ID']).not.toBe(calls[1]!.headers['REQUEST-ID']);
    expect(headers.TIMESTAMP).toBe('2026-11-18T10:00:00.000Z');
    expect(headers['X-CM-ID']).toBe('sbx');
    expect(headers.Authorization).toBe('Bearer gateway-token');
    expect(headers['X-token']).toBe('Bearer user-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(calls[1]!.headers.Authorization).toBeUndefined();
    expect(calls[1]!.headers['Content-Type']).toBeUndefined();
  });

  it('turns a refusal into an error that carries the code and request id', async () => {
    const { fetchImpl } = fakeFetch([
      { status: 404, body: { code: 'ABDM-1114: ', message: 'User not found.' } },
    ]);
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: clock().now });

    const error = await http
      .request({ host: 'abha', method: 'POST', path: '/p' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AbdmApiError);
    const refusal = error as AbdmApiError;
    expect(refusal.status).toBe(404);
    expect(refusal.is('ABDM-1114')).toBe(true);
    expect(refusal.abdmMessage).toBe('User not found.');
    expect(refusal.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('handles a failure with no body, a body that is not JSON, and no answer at all', async () => {
    const { fetchImpl } = fakeFetch([
      { status: 401 },
      { status: 502, text: '<html>Bad gateway</html>' },
      new Error('socket hang up'),
      { status: 202 },
    ]);
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: clock().now });
    const attempt = () =>
      http.request({ host: 'gateway', method: 'GET', path: '/x' }).catch((e: unknown) => e);

    expect(await attempt()).toMatchObject({ status: 401, code: null });
    expect(await attempt()).toMatchObject({ status: 502, code: null });
    expect(await attempt()).toMatchObject({ status: 0, code: null });
    expect(await http.request({ host: 'gateway', method: 'GET', path: '/x' })).toMatchObject({
      status: 202,
      body: null,
    });
  });

  it('logs the request id before sending and never logs a body or a token', async () => {
    const { fetchImpl } = fakeFetch([{ status: 200, body: { secret: 'value-from-abdm' } }]);
    const events: Array<[string, AbdmCallLog]> = [];
    const http = new AbdmHttpClient(CONFIG, {
      fetch: fetchImpl,
      now: clock().now,
      log: (event, detail) => events.push([event, detail]),
    });

    await http.request({
      host: 'abha',
      method: 'POST',
      path: '/p',
      body: { loginId: 'plain-identifier' },
      accessToken: 'gateway-token',
    });

    expect(events.map(([event]) => event)).toEqual(['abdm.request', 'abdm.response']);
    const logged = JSON.stringify(events);
    expect(logged).not.toContain('plain-identifier');
    expect(logged).not.toContain('gateway-token');
    expect(logged).not.toContain('value-from-abdm');
  });
});

describe('AbdmSessionService', () => {
  const session = { accessToken: 'token-1', expiresIn: 1200 };
  const credentials = { clientId: 'client', clientSecret: 'secret' };

  it('opens one session, reuses it, and renews before it expires', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { status: 200, body: session },
      { status: 200, body: { accessToken: 'token-2', expiresIn: 1200 } },
    ]);
    const time = clock();
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: time.now });
    const service = new AbdmSessionService(http, credentials, time.now);

    const [a, b] = await Promise.all([service.accessToken(), service.accessToken()]);
    expect([a, b]).toEqual(['token-1', 'token-1']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`https://gateway.test${GATEWAY_SESSION_PATH}`);
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.body).toEqual({
      clientId: 'client',
      clientSecret: 'secret',
      grantType: 'client_credentials',
    });

    time.advance(1_100_000);
    expect(await service.accessToken()).toBe('token-1');
    time.advance(50_000);
    expect(await service.accessToken()).toBe('token-2');
    expect(calls).toHaveLength(2);
  });

  it('backs off after a refusal instead of asking again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { status: 401, body: { code: '900901', message: 'Invalid Credentials' } },
      { status: 200, body: session },
    ]);
    const time = clock();
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: time.now });
    const service = new AbdmSessionService(http, credentials, time.now);

    await expect(service.accessToken()).rejects.toMatchObject({ status: 401, code: '900901' });
    await expect(service.accessToken()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);

    time.advance(31_000);
    expect(await service.accessToken()).toBe('token-1');
  });

  it('refuses a session response with no token', async () => {
    const { fetchImpl } = fakeFetch([{ status: 200, body: { tokenType: 'bearer' } }]);
    const time = clock();
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: time.now });
    const service = new AbdmSessionService(http, credentials, time.now);

    await expect(service.accessToken()).rejects.toBeInstanceOf(AbdmApiError);
  });
});

describe('AbdmCrypto', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const certificate = {
    publicKey: der,
    encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
  };

  function setup(answers: Parameters<typeof fakeFetch>[0]) {
    const { fetchImpl, calls } = fakeFetch(answers);
    const time = clock();
    const http = new AbdmHttpClient(CONFIG, { fetch: fetchImpl, now: time.now });
    const crypto = new AbdmCrypto(http, () => Promise.resolve('gateway-token'), time.now, 60_000);
    return { crypto, calls, time };
  }

  it('encrypts with the padding the certificate names: OAEP with SHA-1', async () => {
    const { crypto, calls } = setup([{ status: 200, body: certificate }]);

    const encrypted = await crypto.encrypt('synthetic-value-0000');

    expect(calls[0]?.url).toBe(`https://abha.test${ABHA_CERTIFICATE_PATH}`);
    expect(calls[0]?.headers.Authorization).toBe('Bearer gateway-token');
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const plain = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
      Buffer.from(encrypted, 'base64'),
    );
    expect(plain.toString('utf8')).toBe('synthetic-value-0000');
    // SHA-256, the library default, must not be what was used.
    expect(() =>
      privateDecrypt(
        { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(encrypted, 'base64'),
      ),
    ).toThrow();
  });

  it('caches the certificate for its validity window, then reads it again', async () => {
    const { crypto, calls, time } = setup([
      { status: 200, body: certificate },
      { status: 200, body: certificate },
    ]);

    await crypto.encrypt('a');
    await crypto.encrypt('b');
    expect(calls).toHaveLength(1);
    time.advance(61_000);
    await crypto.encrypt('c');
    expect(calls).toHaveLength(2);
  });

  it('accepts a PEM key and refuses an algorithm it does not know', async () => {
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const { crypto } = setup([{ status: 200, body: { ...certificate, publicKey: pem } }]);
    expect(await crypto.encrypt('a')).toMatch(/^[A-Za-z0-9+/]+=*$/);

    expect(() => resolvePadding('RSA/ECB/SomethingNew')).toThrow(AbdmCryptoError);
    expect(() => resolvePadding(undefined)).toThrow(AbdmCryptoError);
    const unknown = setup([{ status: 200, body: { publicKey: der, encryptionAlgorithm: 'X' } }]);
    await expect(unknown.crypto.encrypt('a')).rejects.toBeInstanceOf(AbdmCryptoError);
    const missing = setup([{ status: 200, body: {} }]);
    await expect(missing.crypto.encrypt('a')).rejects.toBeInstanceOf(AbdmCryptoError);
  });
});

describe('ABDM configuration', () => {
  const base = { DATABASE_URL: 'postgresql://localhost/test' };
  const deps = { fetch: globalThis.fetch, now: Date.now };

  it('is off by default and for the labelled simulation', () => {
    expect(createAbdmGateway(buildConfig(base), deps)).toBeNull();
    expect(
      createAbdmGateway(buildConfig({ ...base, ABDM_ADAPTER: 'sandbox-mock' }), deps),
    ).toBeNull();
  });

  it('needs credentials for the sandbox adapter', () => {
    expect(() => buildConfig({ ...base, ABDM_ADAPTER: 'sandbox' })).toThrow(/ABDM_CLIENT_ID/);
    const config = buildConfig({
      ...base,
      ABDM_ADAPTER: 'sandbox',
      ABDM_CLIENT_ID: 'client',
      ABDM_CLIENT_SECRET: 'secret',
    });
    expect(config.env.ABDM_GATEWAY_URL).toBe('https://dev.abdm.gov.in');
    expect(config.env.ABDM_ABHA_URL).toBe('https://abhasbx.abdm.gov.in');
    expect(createAbdmGateway(config, deps)).not.toBeNull();
  });

  it('refuses the sandbox adapter in demo mode', () => {
    expect(() =>
      buildConfig({
        ...base,
        DEMO_MODE: 'true',
        ABDM_ADAPTER: 'sandbox',
        ABDM_CLIENT_ID: 'client',
        ABDM_CLIENT_SECRET: 'secret',
      }),
    ).toThrow(/DEMO_MODE/);
  });
});
