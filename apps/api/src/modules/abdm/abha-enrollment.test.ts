import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildConfig } from '../../config/env.js';
import { AbhaEnrollmentClient, readAbhaProfile } from './abha-enrollment.client.js';
import { shape } from './abdm-scaffold.js';
import { createAbdmGateway } from './abdm.module.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CERTIFICATE = {
  publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
};

function decrypt(value: unknown): string {
  return privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
    Buffer.from(String(value), 'base64'),
  ).toString('utf8');
}

interface Call {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

type Answer = { status?: number; body?: unknown; bytes?: Buffer; contentType?: string };

/** Answers the session and certificate calls itself; the rest come from `routes`. */
function setup(routes: Record<string, Answer | Answer[]>) {
  const calls: Call[] = [];
  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    const path = new URL(url.toString()).pathname;
    if (path.endsWith('/sessions')) {
      return Promise.resolve(Response.json({ accessToken: 'gateway-token', expiresIn: 1200 }));
    }
    if (path.endsWith('/public/certificate')) return Promise.resolve(Response.json(CERTIFICATE));
    calls.push({
      path,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body:
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined,
    });
    const route = routes[path];
    const answer = Array.isArray(route) ? route.shift() : route;
    if (!answer) return Promise.reject(new Error(`no answer for ${path}`));
    if (answer.bytes) {
      return Promise.resolve(
        new Response(new Uint8Array(answer.bytes), {
          status: answer.status ?? 200,
          headers: { 'content-type': answer.contentType ?? 'application/octet-stream' },
        }),
      );
    }
    return Promise.resolve(Response.json(answer.body ?? {}, { status: answer.status ?? 200 }));
  }) as typeof fetch;
  const config = buildConfig({
    DATABASE_URL: 'postgresql://localhost/test',
    ABDM_ADAPTER: 'sandbox',
    ABDM_CLIENT_ID: 'client',
    ABDM_CLIENT_SECRET: 'secret',
  });
  const gateway = createAbdmGateway(config, { fetch: fetchImpl, now: Date.now });
  if (!gateway) throw new Error('gateway not configured');
  return { client: new AbhaEnrollmentClient(gateway), calls };
}

const OTP_PATH = '/abha/api/v3/enrollment/request/otp';
const ENROL_PATH = '/abha/api/v3/enrollment/enrol/byAadhaar';
const AADHAAR = '000000000000';

describe('Aadhaar OTP', () => {
  it('sends the Aadhaar number encrypted, and can carry a transaction id when asked', async () => {
    const { client, calls } = setup({
      [OTP_PATH]: [
        {
          body: {
            txnId: 'txn-1',
            message: 'OTP sent to Aadhaar registered mobile number ending with ******0000',
          },
        },
        { body: { txnId: 'txn-1', message: 'OTP sent again' } },
      ],
    });

    const first = await client.requestAadhaarOtp(AADHAAR);
    const again = await client.requestAadhaarOtp(AADHAAR, first.txnId);

    expect(first).toEqual({
      txnId: 'txn-1',
      message: 'OTP sent to Aadhaar registered mobile number ending with ******0000',
    });
    expect(again.txnId).toBe('txn-1');
    expect(calls[0]?.body).toMatchObject({
      txnId: '',
      scope: ['abha-enrol'],
      loginHint: 'aadhaar',
      otpSystem: 'aadhaar',
    });
    expect(calls[0]?.body?.loginId).not.toContain(AADHAAR);
    expect(decrypt(calls[0]?.body?.loginId)).toBe(AADHAAR);
    expect(calls[1]?.body?.txnId).toBe('txn-1');
    expect(calls[0]?.headers.Authorization).toBe('Bearer gateway-token');
  });

  it('refuses a response that carries no transaction id', async () => {
    const { client } = setup({ [OTP_PATH]: { body: { message: 'ok' } } });
    await expect(client.requestAadhaarOtp(AADHAAR)).rejects.toMatchObject({
      name: 'AbdmApiError',
    });
  });

  it('passes on the refusal ABDM gives for a wrong OTP, with its message as it came', async () => {
    const { client } = setup({
      [ENROL_PATH]: {
        status: 422,
        body: { code: 'ABDM-1204', message: 'UIDAI Error code : 400 : Invalid Aadhaar OTP value.' },
      },
    });
    await expect(
      client.enrolByAadhaar({ txnId: 'txn-1', otp: '000000', mobile: '0000000000' }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'ABDM-1204',
      abdmMessage: 'UIDAI Error code : 400 : Invalid Aadhaar OTP value.',
    });
  });
});

describe('enrolment', () => {
  const profile = {
    ABHANumber: '91-0000-0000-0001',
    phrAddress: ['test.person@sbx'],
    firstName: 'Test',
    lastName: 'Person',
    dob: '01-01-1980',
    gender: 'F',
    mobile: '0000000000',
    abhaStatus: 'ACTIVE',
  };

  it('sends the OTP encrypted with the consent block, and reads the new account', async () => {
    const { client, calls } = setup({
      [ENROL_PATH]: {
        body: {
          message: 'Account created successfully',
          txnId: 'txn-1',
          tokens: { token: 'user-token', expiresIn: 1800, refreshToken: 'refresh-token' },
          ABHAProfile: profile,
          isNew: true,
        },
      },
    });

    const result = await client.enrolByAadhaar({
      txnId: 'txn-1',
      otp: '123456',
      mobile: '0000000000',
    });

    const body = calls[0]?.body as {
      authData: { authMethods: string[]; otp: { txnId: string; otpValue: string; mobile: string } };
      consent: unknown;
    };
    expect(body.consent).toEqual({ code: 'abha-enrollment', version: '1.4' });
    expect(body.authData.authMethods).toEqual(['otp']);
    expect(body.authData.otp.txnId).toBe('txn-1');
    expect(body.authData.otp.mobile).toBe('0000000000');
    expect(decrypt(body.authData.otp.otpValue)).toBe('123456');
    expect(result).toMatchObject({
      isNew: true,
      txnId: 'txn-1',
      userToken: 'user-token',
      refreshToken: 'refresh-token',
      profile: {
        abhaNumber: '91-0000-0000-0001',
        preferredAbhaAddress: 'test.person@sbx',
        firstName: 'Test',
        mobile: '0000000000',
      },
    });
  });

  it('treats an Aadhaar that already holds an ABHA as a result, not an error', async () => {
    const { client } = setup({
      [ENROL_PATH]: {
        body: {
          message: 'This account already exist',
          txnId: 'txn-1',
          tokens: { token: 'user-token' },
          ABHAProfile: profile,
          isNew: false,
        },
      },
    });
    const result = await client.enrolByAadhaar({
      txnId: 'txn-1',
      otp: '123456',
      mobile: '0000000000',
    });
    expect(result.isNew).toBe(false);
    expect(result.message).toBe('This account already exist');
    expect(result.userToken).toBe('user-token');
    expect(result.profile.abhaNumber).toBe('91-0000-0000-0001');
  });

  it('reads a profile whichever way its keys are written, and an empty one', () => {
    expect(
      readAbhaProfile({ abhaNumber: '1', preferredAbhaAddress: 'a@sbx', pincode: 500001 }),
    ).toMatchObject({ abhaNumber: '1', preferredAbhaAddress: 'a@sbx', pinCode: '500001' });
    expect(readAbhaProfile(null)).toMatchObject({ abhaNumber: null, abhaAddresses: [] });
    // The keys the sandbox returned on 2026-11-19: enrolment, then the profile call.
    expect(
      readAbhaProfile({
        ABHANumber: '91-0000-0000-0001',
        preferredAddress: 'test.person@sbx',
        phrAddress: ['test.person@sbx'],
        dob: '01-01-1980',
        pinCode: '500001',
        communicationMobile: null,
      }),
    ).toMatchObject({
      preferredAbhaAddress: 'test.person@sbx',
      dateOfBirth: '01-01-1980',
      kycVerified: null,
    });
    expect(
      readAbhaProfile({
        ABHANumber: '91-0000-0000-0001',
        preferredAbhaAddress: 'test.person@sbx',
        name: 'Test Person',
        yearOfBirth: '1980',
        monthOfBirth: '1',
        dayOfBirth: '01',
        pincode: '500001',
        profilePhoto: 'aGk=',
        status: 'ACTIVE',
        kycVerified: true,
        mobileVerified: true,
      }),
    ).toMatchObject({
      dateOfBirth: '01-01-1980',
      pinCode: '500001',
      photo: 'aGk=',
      abhaStatus: 'ACTIVE',
      kycVerified: true,
      mobileVerified: true,
    });
  });
});

describe('communication mobile, address, profile and card', () => {
  it('verifies a different mobile by OTP and lets the body decide the outcome', async () => {
    const { client, calls } = setup({
      [OTP_PATH]: {
        body: { txnId: 'txn-1', message: 'OTP sent to mobile number ending with ******0001' },
      },
      '/abha/api/v3/enrollment/auth/byAbdm': [
        { body: { txnId: 'txn-1', authResult: 'Failed', message: 'Invalid OTP' } },
        {
          body: {
            txnId: 'txn-1',
            authResult: 'success',
            message: 'Mobile number is now successfully linked',
          },
        },
      ],
    });

    await client.requestMobileOtp('txn-1', '0000000001');
    const wrong = await client.verifyMobileOtp('txn-1', '000000');
    const right = await client.verifyMobileOtp('txn-1', '123456');

    expect(calls[0]?.body).toMatchObject({
      txnId: 'txn-1',
      scope: ['abha-enrol', 'mobile-verify'],
      loginHint: 'mobile',
      otpSystem: 'abdm',
    });
    expect(decrypt(calls[0]?.body?.loginId)).toBe('0000000001');
    expect(wrong).toMatchObject({ verified: false, message: 'Invalid OTP' });
    expect(right.verified).toBe(true);
    expect(calls[2]?.body).toMatchObject({ scope: ['abha-enrol', 'mobile-verify'] });
  });

  it('asks for suggestions and creates an address within the transaction', async () => {
    const { client, calls } = setup({
      '/abha/api/v3/enrollment/enrol/suggestion': {
        body: { txnId: 'txn-1', abhaAddressList: ['test.person', 'test_person', 'testperson80'] },
      },
      '/abha/api/v3/enrollment/enrol/abha-address': {
        body: {
          txnId: 'txn-1',
          healthIdNumber: '91-0000-0000-0001',
          preferredAbhaAddress: 'test.person@sbx',
        },
      },
    });

    expect(await client.addressSuggestions('txn-1')).toHaveLength(3);
    expect(calls[0]?.headers.TRANSACTION_ID).toBe('txn-1');
    expect(await client.createAddress('txn-1', 'test.person')).toEqual({
      txnId: 'txn-1',
      abhaNumber: '91-0000-0000-0001',
      preferredAbhaAddress: 'test.person@sbx',
    });
    expect(calls[1]?.body).toEqual({ txnId: 'txn-1', abhaAddress: 'test.person', preferred: 1 });
  });

  it('reads the profile and the card with the user token', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const { client, calls } = setup({
      '/abha/api/v3/profile/account': {
        body: { ABHANumber: '91-0000-0000-0001', mobile: '0000000001' },
      },
      '/abha/api/v3/profile/account/abha-card': { bytes: png, contentType: 'image/png' },
    });

    expect((await client.profile('user-token')).mobile).toBe('0000000001');
    const card = await client.card('user-token');

    expect(calls[0]?.headers['X-token']).toBe('Bearer user-token');
    expect(calls[1]?.headers['X-token']).toBe('Bearer user-token');
    expect(card.contentType).toBe('image/png');
    expect(card.bytes.equals(png)).toBe(true);
  });
});

describe('the sandbox run script', () => {
  it('prints the shape of a response and never an identifier or a token', () => {
    const printed = JSON.stringify(
      shape({
        message: 'This account already exist',
        isNew: false,
        txnId: 'txn-secret-value',
        tokens: { token: 'jwt-secret-value', expiresIn: 1800 },
        ABHAProfile: {
          ABHANumber: '91-0000-0000-0001',
          phrAddress: ['test.person@sbx'],
          mobile: '0000000000',
        },
      }),
    );
    expect(printed).toContain('This account already exist');
    expect(printed).toContain('"isNew":false');
    for (const secret of [
      'txn-secret-value',
      'jwt-secret-value',
      '91-0000',
      'test.person',
      '0000000000',
    ]) {
      expect(printed).not.toContain(secret);
    }
    expect(printed).toContain('string(17)');
    expect(printed).toContain('array(1) of');
  });
});
