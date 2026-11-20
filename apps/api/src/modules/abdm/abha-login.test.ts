import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildConfig } from '../../config/env.js';
import { readAbhaProfile } from './abha-enrollment.client.js';
import { AbhaLoginClient, formatAbhaNumber, readLoginResult } from './abha-login.client.js';
import { refusal, shape } from './abdm-scaffold.js';
import { readAbdmError } from './abdm-http.client.js';
import { createAbdmGateway } from './abdm.module.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const decrypt = (value: unknown) =>
  privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
    Buffer.from(String(value), 'base64'),
  ).toString('utf8');

interface Call {
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

function setup(routes: Record<string, { status?: number; body?: unknown; bytes?: Buffer }>) {
  const calls: Call[] = [];
  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    const path = new URL(url.toString()).pathname;
    if (path.endsWith('/sessions')) {
      return Promise.resolve(Response.json({ accessToken: 'gateway-token', expiresIn: 1200 }));
    }
    if (path.endsWith('/public/certificate')) {
      return Promise.resolve(
        Response.json({
          publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
          encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
        }),
      );
    }
    calls.push({
      path,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body:
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined,
    });
    const answer = routes[path];
    if (!answer) return Promise.reject(new Error(`no answer for ${path}`));
    if (answer.bytes) {
      return Promise.resolve(
        new Response(new Uint8Array(answer.bytes), {
          status: answer.status ?? 200,
          headers: { 'content-type': 'image/png' },
        }),
      );
    }
    return Promise.resolve(Response.json(answer.body ?? {}, { status: answer.status ?? 200 }));
  }) as typeof fetch;
  const gateway = createAbdmGateway(
    buildConfig({
      DATABASE_URL: 'postgresql://localhost/test',
      ABDM_ADAPTER: 'sandbox',
      ABDM_CLIENT_ID: 'client',
      ABDM_CLIENT_SECRET: 'secret',
    }),
    { fetch: fetchImpl, now: Date.now },
  );
  if (!gateway) throw new Error('gateway not configured');
  return { client: new AbhaLoginClient(gateway), calls };
}

const REQUEST = '/abha/api/v3/profile/login/request/otp';
const VERIFY = '/abha/api/v3/profile/login/verify';
const SUCCESS = {
  txnId: 'txn-1',
  authResult: 'success',
  message: 'OTP verified successfully',
  token: 'user-token',
  refreshToken: 'refresh-token',
  accounts: [
    {
      ABHANumber: '91-0000-0000-0001',
      preferredAbhaAddress: 'test.person@sbx',
      name: 'Test Person',
    },
  ],
};

describe('login by ABHA number and by Aadhaar number', () => {
  it('sends the identifier encrypted with the scope for the chosen OTP', async () => {
    const { client, calls } = setup({
      [REQUEST]: { body: { txnId: 'txn-1', message: 'OTP sent' } },
    });

    await client.requestOtp({
      identifier: 'abha-number',
      value: '91000000000001',
      otpSystem: 'aadhaar',
    });
    await client.requestOtp({
      identifier: 'abha-number',
      value: '91000000000001',
      otpSystem: 'abdm',
    });
    await client.requestOtp({ identifier: 'aadhaar', value: '000000000000', otpSystem: 'aadhaar' });

    expect(calls[0]?.body).toMatchObject({
      scope: ['abha-login', 'aadhaar-verify'],
      loginHint: 'abha-number',
      otpSystem: 'aadhaar',
    });
    expect(calls[1]?.body).toMatchObject({
      scope: ['abha-login', 'mobile-verify'],
      otpSystem: 'abdm',
    });
    expect(calls[2]?.body).toMatchObject({ loginHint: 'aadhaar', otpSystem: 'aadhaar' });
    expect(decrypt(calls[0]?.body?.loginId)).toBe('91-0000-0000-0001');
    expect(decrypt(calls[2]?.body?.loginId)).toBe('000000000000');
    expect(JSON.stringify(calls)).not.toContain('000000000000');
  });

  it('verifies with the OTP encrypted and reads the token and the accounts', async () => {
    const { client, calls } = setup({ [VERIFY]: { body: SUCCESS } });
    const result = await client.verifyOtp({ txnId: 'txn-1', otp: '123456', otpSystem: 'abdm' });

    const body = calls[0]?.body as {
      scope: string[];
      authData: { otp: { txnId: string; otpValue: string } };
    };
    expect(body.scope).toEqual(['abha-login', 'mobile-verify']);
    expect(body.authData.otp.txnId).toBe('txn-1');
    expect(decrypt(body.authData.otp.otpValue)).toBe('123456');
    expect(result).toMatchObject({
      verified: true,
      userToken: 'user-token',
      refreshToken: 'refresh-token',
      message: 'OTP verified successfully',
    });
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({
      abhaNumber: '91-0000-0000-0001',
      preferredAbhaAddress: 'test.person@sbx',
      firstName: 'Test Person',
    });
  });

  it('lets the body decide, wherever the token sits', () => {
    expect(
      readLoginResult({ authResult: 'Failed', message: 'Invalid OTP', token: 'x' }),
    ).toMatchObject({
      verified: false,
      message: 'Invalid OTP',
    });
    expect(readLoginResult({ tokens: { token: 't', refreshToken: 'r' } })).toMatchObject({
      verified: true,
      userToken: 't',
      refreshToken: 'r',
      accounts: [],
    });
    expect(readLoginResult(null)).toMatchObject({ verified: false, userToken: null });
  });

  it('passes on "no ABHA for this Aadhaar" as ABDM says it', async () => {
    const { client } = setup({
      [VERIFY]: {
        status: 404,
        body: { code: 'ABDM-1114', message: 'No ABHA user registered with this Aadhaar number.' },
      },
    });
    await expect(
      client.verifyOtp({ txnId: 'txn-1', otp: '123456', otpSystem: 'aadhaar' }),
    ).rejects.toMatchObject({
      status: 404,
      code: 'ABDM-1114',
      abdmMessage: 'No ABHA user registered with this Aadhaar number.',
    });
  });
});

describe('login by ABHA address', () => {
  it('reads the methods the address offers, as ABDM names them', async () => {
    const { client, calls } = setup({
      '/abha/api/v3/phr/web/login/abha/search': {
        body: {
          abhaAddress: 'test.person@sbx',
          authMethods: ['AADHAAR_OTP', 'MOBILE_OTP'],
          status: 'ACTIVE',
        },
      },
    });
    const found = await client.searchAddress('test.person@sbx');
    expect(found).toEqual({ authMethods: ['AADHAAR_OTP', 'MOBILE_OTP'], status: 'ACTIVE' });
    expect(calls[0]?.body).toEqual({ abhaAddress: 'test.person@sbx' });
  });

  it('sends, verifies, and reads the profile and card with that login’s token', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const { client, calls } = setup({
      '/abha/api/v3/phr/web/login/abha/request/otp': {
        body: { txnId: 'txn-a', message: 'OTP sent' },
      },
      '/abha/api/v3/phr/web/login/abha/verify': { body: { ...SUCCESS, txnId: 'txn-a' } },
      '/abha/api/v3/phr/web/login/profile/abha-profile': {
        body: {
          abhaNumber: '91-0000-0000-0001',
          preferredAbhaAddress: 'test.person@sbx',
          mobile: '0000000001',
        },
      },
      '/abha/api/v3/phr/web/login/profile/abha/phr-card': { bytes: png },
    });

    await client.requestAddressOtp('test.person@sbx', 'abdm');
    const result = await client.verifyAddressOtp({
      txnId: 'txn-a',
      otp: '123456',
      otpSystem: 'abdm',
    });
    const profile = await client.addressProfile('user-token');
    const card = await client.addressCard('user-token');

    expect(calls[0]?.body).toMatchObject({
      scope: ['abha-address-login', 'mobile-verify'],
      loginHint: 'abha-address',
      otpSystem: 'abdm',
    });
    expect(decrypt(calls[0]?.body?.loginId)).toBe('test.person@sbx');
    expect(calls[1]?.body).toMatchObject({ scope: ['abha-address-login', 'mobile-verify'] });
    expect(result.verified).toBe(true);
    expect(calls[2]?.headers['X-token']).toBe('Bearer user-token');
    expect(profile).toMatchObject({ abhaNumber: '91-0000-0000-0001', mobile: '0000000001' });
    expect(card.bytes.equals(png)).toBe(true);
  });
});

describe('updating the mobile on the ABHA profile', () => {
  it('uses the login’s token and the profile scope, and lets the body decide', async () => {
    const { client, calls } = setup({
      '/abha/api/v3/profile/account/request/otp': { body: { txnId: 'txn-m', message: 'OTP sent' } },
      '/abha/api/v3/profile/account/verify': {
        body: {
          txnId: 'txn-m',
          authResult: 'success',
          message: 'Mobile Number linked successfully',
        },
      },
    });

    const sent = await client.requestMobileUpdateOtp('user-token', '0000000002');
    const done = await client.verifyMobileUpdateOtp('user-token', sent.txnId, '123456');

    expect(calls[0]?.headers['X-token']).toBe('Bearer user-token');
    expect(calls[0]?.body).toMatchObject({
      scope: ['abha-profile', 'mobile-verify'],
      loginHint: 'mobile',
      otpSystem: 'abdm',
    });
    expect(decrypt(calls[0]?.body?.loginId)).toBe('0000000002');
    expect(calls[1]?.body).toMatchObject({ scope: ['abha-profile', 'mobile-verify'] });
    expect(done).toEqual({ verified: true, message: 'Mobile Number linked successfully' });
  });
});

describe('the run script’s printing', () => {
  it('shows login method names and hides everything else', () => {
    const printed = JSON.stringify(
      shape({
        abhaAddress: 'test.person@sbx',
        authMethods: ['AADHAAR_OTP', 'MOBILE_OTP'],
        token: 'secret-jwt',
      }),
    );
    expect(printed).toContain('AADHAAR_OTP');
    expect(printed).not.toContain('test.person');
    expect(printed).not.toContain('secret-jwt');
  });
});

describe('what the sandbox returned on 2026-11-20', () => {
  it('sends a 14-digit ABHA number in ABDM’s hyphenated form, and leaves anything else alone', () => {
    expect(formatAbhaNumber('91000000000001')).toBe('91-0000-0000-0001');
    expect(formatAbhaNumber(' 91 0000 0000 0001 ')).toBe('91-0000-0000-0001');
    expect(formatAbhaNumber('91-0000-0000-0001')).toBe('91-0000-0000-0001');
    expect(formatAbhaNumber('9100000001')).toBe('9100000001');
    expect(formatAbhaNumber('test.person@sbx')).toBe('test.person@sbx');
  });

  it('encrypts the hyphenated form when logging in by ABHA number', async () => {
    const { client, calls } = setup({
      [REQUEST]: { body: { txnId: 'txn-1', message: 'OTP sent' } },
    });
    await client.requestOtp({
      identifier: 'abha-number',
      value: '91000000000001',
      otpSystem: 'abdm',
    });
    expect(decrypt(calls[0]?.body?.loginId)).toBe('91-0000-0000-0001');
  });

  it('reads a validation refusal, which names a field and has no code or message', async () => {
    expect(readAbdmError({ loginId: 'Invalid LoginId', timestamp: '2026-11-20 09:06:37' })).toEqual(
      {
        code: null,
        message: 'Invalid LoginId',
      },
    );
    expect(readAbdmError({ txnId: 'Invalid Transaction Id', timestamp: 'x' }).message).toBe(
      'Invalid Transaction Id',
    );
    expect(readAbdmError({ code: 'ABDM-1114', message: 'User not found.' })).toEqual({
      code: 'ABDM-1114',
      message: 'User not found.',
    });
    expect(readAbdmError({ timestamp: 'x' }).message).toBeNull();

    const { client } = setup({
      [REQUEST]: {
        status: 400,
        body: { loginId: 'Invalid LoginId', timestamp: '2026-11-20 09:06:37' },
      },
    });
    await expect(
      client.requestOtp({ identifier: 'abha-number', value: 'x', otpSystem: 'abdm' }),
    ).rejects.toMatchObject({ status: 400, code: null, abdmMessage: 'Invalid LoginId' });
  });

  it('reads an ABHA-address login, which lists `users` and nests its token', () => {
    const result = readLoginResult({
      txnId: 'txn',
      message: 'OTP verified successfully',
      authResult: 'success',
      users: [
        {
          abhaAddress: 'test.person@sbx',
          fullName: 'Test Person',
          abhaNumber: '91-0000-0000-0001',
          status: 'ACTIVE',
          kycStatus: 'VERIFIED',
          age: 46,
        },
      ],
      tokens: {
        token: 'user-token',
        expiresIn: 1800,
        refreshToken: 'refresh',
        switchProfileEnabled: false,
      },
    });
    expect(result).toMatchObject({
      verified: true,
      userToken: 'user-token',
      refreshToken: 'refresh',
    });
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({
      abhaNumber: '91-0000-0000-0001',
      preferredAbhaAddress: 'test.person@sbx',
      firstName: 'Test Person',
      abhaStatus: 'ACTIVE',
      kycVerified: true,
    });
  });

  it('reads an ABHA-address profile with its own key names', () => {
    expect(
      readAbhaProfile({
        abhaAddress: 'test.person@sbx',
        fullName: 'Test Middle Person',
        firstName: 'Test',
        middleName: 'Middle',
        lastName: 'Person',
        dayOfBirth: '9',
        monthOfBirth: '3',
        yearOfBirth: '1980',
        dateOfBirth: '9-3-1980',
        gender: 'M',
        email: 'test@example.test',
        mobile: '0000000001',
        abhaNumber: '91-0000-0000-0001',
        address: '1 Sample Street',
        stateName: 'Telangana',
        districtName: 'Hyderabad',
        pinCode: '500001',
        status: 'ACTIVE',
        mobileVerified: 'true',
        kycStatus: 'VERIFIED',
      }),
    ).toMatchObject({
      abhaNumber: '91-0000-0000-0001',
      preferredAbhaAddress: 'test.person@sbx',
      firstName: 'Test',
      lastName: 'Person',
      dateOfBirth: '09-03-1980',
      email: 'test@example.test',
      pinCode: '500001',
      mobileVerified: true,
      kycVerified: true,
    });
    expect(readAbhaProfile({ kycStatus: 'PENDING' }).kycVerified).toBe(false);
    expect(readAbhaProfile({ kycStatus: 'SOMETHING_NEW' }).kycVerified).toBeNull();
    expect(readAbhaProfile({ kycVerified: false, kycStatus: 'VERIFIED' }).kycVerified).toBe(false);
  });

  it('shows a refusal’s own words in the run script, with digit runs masked', () => {
    const printed = JSON.stringify(
      refusal({ loginId: 'Invalid LoginId 91000000000001', timestamp: '2026-11-20 09:06:37' }),
    );
    expect(printed).toContain('Invalid LoginId');
    expect(printed).not.toContain('91000000000001');
  });
});
