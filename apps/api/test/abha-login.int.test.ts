/**
 * The three ABHA logins, through the real API against a fake ABDM. Every
 * identity here is made up; nothing leaves the machine.
 */
import { generateKeyPairSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { ABHA_TEXT } from '@healthguard/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildConfig } from '../src/config/env.js';
import { RedisService } from '../src/infrastructure/redis/redis.service.js';
import { ABDM_GATEWAY, createAbdmGateway } from '../src/modules/abdm/abdm.module.js';
import { db, EMAIL, resetTo, signIn, startApp, type Session } from './harness.js';

const CLINIC = '019f0000-0000-7000-8000-0000000106a0';
const DESK_USER = '019f0000-0000-7000-8000-0000000106a1';
// Test-only, for a user this file creates and deletes. Same value as the registration test.
const PASSWORD = 'Registration-Test-2026';
const AADHAAR = '000000000000';
const ABHA_NUMBER = '91-0000-0000-0077';
const ABHA_ADDRESS = 'login.person@sbx';
const ABHA_MOBILE = '0000000077';
const RIGHT_OTP = '123456';

const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

interface FakeCall {
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

const abdm = {
  calls: [] as FakeCall[],
  sends: 0,
  wrongNext: false,
  noAbha: false,
  addressMethods: ['AADHAAR_OTP', 'MOBILE_OTP'],
  mobile: ABHA_MOBILE,
};

const account = () => ({
  ABHANumber: ABHA_NUMBER,
  preferredAbhaAddress: ABHA_ADDRESS,
  name: 'Login Person',
  status: 'ACTIVE',
  profilePhoto: 'aGk=',
});
const fullProfile = () => ({
  ABHANumber: ABHA_NUMBER,
  preferredAbhaAddress: ABHA_ADDRESS,
  mobile: abdm.mobile,
  firstName: 'Login',
  lastName: 'Person',
  name: 'Login Person',
  yearOfBirth: '1975',
  monthOfBirth: '03',
  dayOfBirth: '09',
  gender: 'M',
  status: 'ACTIVE',
  kycVerified: true,
  email: 'login.person@example.test',
  address: '7 Sample Lane',
  townName: 'Secunderabad',
  districtName: 'Hyderabad',
  stateName: 'Telangana',
  pincode: '500003',
});

const fakeFetch = ((url: string | URL, init?: RequestInit) => {
  const path = new URL(url.toString()).pathname;
  const body =
    typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
  const json = (value: unknown, status = 200) => Promise.resolve(Response.json(value, { status }));
  if (path.endsWith('/sessions')) return json({ accessToken: 'gateway-token', expiresIn: 1200 });
  if (path.endsWith('/public/certificate')) {
    return json({
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
    });
  }
  abdm.calls.push({ path, headers: (init?.headers ?? {}) as Record<string, string>, body });
  const png = () =>
    Promise.resolve(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
  if (path.endsWith('/abha/search')) {
    return json({ abhaAddress: body?.abhaAddress, authMethods: abdm.addressMethods });
  }
  if (path.endsWith('/login/request/otp') || path.endsWith('/abha/request/otp')) {
    abdm.sends += 1;
    return json({
      txnId: `txn-${abdm.sends}`,
      message:
        body?.otpSystem === 'aadhaar'
          ? 'OTP sent to Aadhaar registered mobile number ending with ******0077'
          : 'OTP sent to mobile number ending with ******0077',
    });
  }
  if (path.endsWith('/login/verify') || path.endsWith('/abha/verify')) {
    const txnId = (body?.authData as { otp: { txnId: string } }).otp.txnId;
    if (abdm.wrongNext) {
      abdm.wrongNext = false;
      return json({ txnId, authResult: 'Failed', message: 'Entered OTP is incorrect' });
    }
    if (abdm.noAbha) {
      return json(
        { code: 'ABDM-1114', message: 'No ABHA user registered with this Aadhaar number.' },
        404,
      );
    }
    return json({
      txnId,
      authResult: 'success',
      message: 'OTP verified successfully',
      token: `user-token-for-${path.includes('/phr/') ? 'address' : 'abha'}`,
      refreshToken: 'refresh-token',
      accounts: [account()],
    });
  }
  if (path.endsWith('/profile/account/request/otp')) {
    return json({
      txnId: 'txn-update',
      message: 'OTP sent to mobile number ending with ******0088',
    });
  }
  if (path.endsWith('/profile/account/verify')) {
    if (abdm.wrongNext) {
      abdm.wrongNext = false;
      return json({
        txnId: 'txn-update',
        authResult: 'Failed',
        message: 'Entered OTP is incorrect',
      });
    }
    abdm.mobile = '0000000088';
    return json({
      txnId: 'txn-update',
      authResult: 'success',
      message: 'Mobile Number linked successfully',
    });
  }
  if (path.endsWith('/profile/abha-profile') || path.endsWith('/profile/account'))
    return json(fullProfile());
  if (path.endsWith('/abha/phr-card') || path.endsWith('/account/abha-card')) return png();
  return Promise.reject(new Error(`fake ABDM has no answer for ${path}`));
}) as typeof fetch;

const gateway = createAbdmGateway(
  buildConfig({
    DATABASE_URL: 'postgresql://localhost/test',
    ABDM_ADAPTER: 'sandbox',
    ABDM_CLIENT_ID: 'client',
    ABDM_CLIENT_SECRET: 'secret',
  }),
  { fetch: fakeFetch, now: () => Date.now() },
);

const CONSENT = {
  termsAgreed: true,
  aadhaarSharing: true,
  otherDocument: false,
  recordsLinking: true,
  recordsSharing: true,
  anonymizedUse: true,
  workerConfirmed: true,
  beneficiaryConfirmed: true,
};
const LOGINS = '/api/v1/abha/logins';
const JOURNEYS = '/api/v1/abha/enrolments';

let app: INestApplication;
let desk: Session;

const post = (session: Session, url: string, body?: object) =>
  session.agent
    .post(url)
    .set('X-CSRF-Token', session.csrf)
    .send(body ?? {});
const lastCall = (suffix: string) => abdm.calls.filter((call) => call.path.endsWith(suffix)).at(-1);

async function login(body: object): Promise<string> {
  const started = await post(desk, LOGINS, body).expect(201);
  const journeyId = started.body.data.journeyId as string;
  await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(200);
  return journeyId;
}

async function removeClinic(): Promise<void> {
  await db.authSession.deleteMany({
    where: { OR: [{ userId: DESK_USER }, { activeOrganizationId: CLINIC }] },
  });
  await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
  await db.organizationMember.deleteMany({ where: { organizationId: CLINIC } });
  await db.user.deleteMany({ where: { id: DESK_USER } });
  await db.organization.deleteMany({ where: { id: CLINIC } });
}

beforeAll(async () => {
  await removeClinic();
  app = await startApp([{ provide: ABDM_GATEWAY, useValue: gateway }]);
  await resetTo(app, 0);
  await db.organization.create({
    data: {
      id: CLINIC,
      slug: 'login-test-clinic',
      name: 'Login Test Clinic',
      type: 'CLINIC',
      isDemo: false,
    },
  });
  await db.user.create({
    data: {
      id: DESK_USER,
      email: 'desk@login-clinic.test',
      displayName: 'Desk',
      passwordHash: await hash(PASSWORD),
    },
  });
  await db.organizationMember.create({
    data: {
      organizationId: CLINIC,
      userId: DESK_USER,
      roles: ['FRONT_DESK'],
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post('/api/v1/auth/login')
    .send({ email: 'desk@login-clinic.test', password: PASSWORD })
    .expect(200);
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  desk = {
    agent,
    csrf:
      cookies
        .find((cookie) => cookie.startsWith('hg_csrf='))
        ?.split(';')[0]
        ?.split('=')[1] ?? '',
  };
});

afterAll(async () => {
  vi.useRealTimers();
  await removeClinic();
  await app.close();
});

describe('login with an ABHA number', () => {
  it('offers both OTP routes and sends each with its own scope', async () => {
    const aadhaar = await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'AADHAAR_OTP',
    }).expect(201);
    expect(aadhaar.body.data.message).toContain('Aadhaar registered mobile');
    expect(lastCall('/login/request/otp')?.body).toMatchObject({
      scope: ['abha-login', 'aadhaar-verify'],
      loginHint: 'abha-number',
      otpSystem: 'aadhaar',
    });

    await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'MOBILE_OTP',
    }).expect(201);
    expect(lastCall('/login/request/otp')?.body).toMatchObject({
      scope: ['abha-login', 'mobile-verify'],
      otpSystem: 'abdm',
    });
    expect(JSON.stringify(abdm.calls)).not.toContain(ABHA_NUMBER);
  });

  it('keeps the transaction after a wrong OTP, then fills the profile and saves one patient', async () => {
    const started = await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'MOBILE_OTP',
      deskMobile: ABHA_MOBILE,
    }).expect(201);
    const journeyId = started.body.data.journeyId as string;

    abdm.wrongNext = true;
    const wrong = await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: '000000' }).expect(422);
    expect(wrong.body).toMatchObject({ code: 'ABDM_REFUSED', detail: 'Entered OTP is incorrect' });
    const verified = await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(
      200,
    );
    const txns = abdm.calls
      .filter((call) => call.path.endsWith('/login/verify'))
      .slice(-2)
      .map((call) => (call.body?.authData as { otp: { txnId: string } }).otp.txnId);
    expect(new Set(txns).size).toBe(1);
    expect(verified.body.data).toMatchObject({
      outcome: 'VERIFIED',
      accounts: 1,
      profile: { abhaNumber: ABHA_NUMBER, preferredAbhaAddress: ABHA_ADDRESS },
      // The desk's mobile is the one on the ABHA, so no update is offered.
      mobileUpdate: 'NOT_NEEDED',
    });

    const profile = await desk.agent.get(`${JOURNEYS}/${journeyId}/profile`).expect(200);
    expect(profile.body.data).toMatchObject({
      name: 'Login Person',
      dateOfBirth: '09-03-1975',
      gender: 'M',
      mobile: ABHA_MOBILE,
      kycVerified: true,
    });
    expect(lastCall('/profile/account')?.headers['X-token']).toBe('Bearer user-token-for-abha');
    const card = await desk.agent.get(`${JOURNEYS}/${journeyId}/card`).expect(200);
    expect(card.headers['content-type']).toBe('image/png');

    const saved = await post(desk, `${JOURNEYS}/${journeyId}/save`, {
      action: 'CREATE',
      phone: '0000000055',
    }).expect(200);
    expect(saved.body.data).toMatchObject({
      status: 'CREATED',
      patient: { displayName: 'Login Person', abhaLinked: true },
    });
    const row = await db.patientProfile.findUniqueOrThrow({
      where: { id: saved.body.data.patient.id as string },
    });
    expect(row).toMatchObject({
      abhaNumber: '91000000000077',
      abhaAddress: ABHA_ADDRESS,
      sex: 'MALE',
      phone: '0000000055',
    });
    expect(row.dateOfBirth.toISOString().slice(0, 10)).toBe('1975-03-09');

    // A second visit finds that record instead of making another.
    const again = await login({
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'MOBILE_OTP',
    });
    const matches = await desk.agent.get(`${JOURNEYS}/${again}/matches`).expect(200);
    expect(matches.body.data).toMatchObject({
      mayCreate: false,
      matches: [{ reason: 'ABHA_NUMBER' }],
    });
    expect(await db.patientProfile.count({ where: { organizationId: CLINIC } })).toBe(1);
  });

  it('saves straight from a login without the profile screen, fetching the date of birth itself', async () => {
    await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
    const journeyId = await login({
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'AADHAAR_OTP',
    });
    const saved = await post(desk, `${JOURNEYS}/${journeyId}/save`, { action: 'CREATE' }).expect(
      200,
    );
    expect(saved.body.data.status).toBe('CREATED');
  });

  it('saves the ABHA’s contact details, and what the desk changed instead where it did', async () => {
    await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
    const fromAbha = await login({
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'AADHAAR_OTP',
    });
    const first = await post(desk, `${JOURNEYS}/${fromAbha}/save`, { action: 'CREATE' }).expect(
      200,
    );
    expect(
      await db.patientProfile.findUniqueOrThrow({
        where: { id: first.body.data.patient.id as string },
      }),
    ).toMatchObject({
      email: 'login.person@example.test',
      addressLine: '7 Sample Lane',
      city: 'Secunderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500003',
    });

    await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
    const edited = await login({
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'AADHAAR_OTP',
    });
    const view = await desk.agent.get(`${JOURNEYS}/${edited}/profile`).expect(200);
    expect(view.body.data).toMatchObject({
      city: 'Secunderabad',
      email: 'login.person@example.test',
    });
    const second = await post(desk, `${JOURNEYS}/${edited}/save`, {
      action: 'CREATE',
      contact: { email: '', addressLine: '9 New Street', city: 'Warangal', pinCode: '506002' },
    }).expect(200);
    expect(
      await db.patientProfile.findUniqueOrThrow({
        where: { id: second.body.data.patient.id as string },
      }),
    ).toMatchObject({
      // Cleared by the desk, changed by the desk, and left as the ABHA had them.
      email: null,
      addressLine: '9 New Street',
      city: 'Warangal',
      pinCode: '506002',
      district: 'Hyderabad',
      state: 'Telangana',
    });
    await post(desk, `${JOURNEYS}/${edited}/save`, {
      action: 'CREATE',
      contact: { email: 'nope' },
    }).expect(400);
  });

  it('resends as a fresh send after 60 seconds, twice at most', async () => {
    const started = await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'MOBILE_OTP',
    }).expect(201);
    const journeyId = started.body.data.journeyId as string;
    const resend = () => post(desk, `${LOGINS}/${journeyId}/resend`, { value: ABHA_NUMBER });
    const sendsBefore = abdm.sends;
    expect((await resend().expect(409)).body.detail).toMatch(/available in \d+ seconds/);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 61_000);
      expect((await resend().expect(200)).body.data.resendsLeft).toBe(1);
      vi.setSystemTime(Date.now() + 61_000);
      expect((await resend().expect(200)).body.data.resendsLeft).toBe(0);
      vi.setSystemTime(Date.now() + 61_000);
      expect((await resend().expect(409)).body.detail).toBe(ABHA_TEXT.resendLimit);
    } finally {
      vi.useRealTimers();
    }
    expect(abdm.sends).toBe(sendsBefore + 2);
    await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(200);
    const verify = lastCall('/login/verify')?.body?.authData as { otp: { txnId: string } };
    expect(verify.otp.txnId).toBe(`txn-${abdm.sends}`);
  });
});

describe('the mobile update offer', () => {
  it('is offered when the desk’s mobile differs, and is done only when ABDM says so', async () => {
    abdm.mobile = ABHA_MOBILE;
    const started = await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'AADHAAR_OTP',
      deskMobile: '0000000088',
    }).expect(201);
    const journeyId = started.body.data.journeyId as string;
    const verified = await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(
      200,
    );
    expect(verified.body.data).toMatchObject({
      mobileUpdate: 'OFFER',
      profile: { mobile: ABHA_MOBILE, dateOfBirth: '09-03-1975' },
    });

    await post(desk, `${LOGINS}/${journeyId}/mobile-update/verify`, { otp: RIGHT_OTP }).expect(409);
    const sent = await post(desk, `${LOGINS}/${journeyId}/mobile-update`, {
      mobile: '0000000088',
    }).expect(200);
    expect(sent.body.data.message).toContain('******0088');
    expect(lastCall('/profile/account/request/otp')?.headers['X-token']).toBe(
      'Bearer user-token-for-abha',
    );

    abdm.wrongNext = true;
    const wrong = await post(desk, `${LOGINS}/${journeyId}/mobile-update/verify`, {
      otp: '000000',
    }).expect(200);
    expect(wrong.body.data).toEqual({ verified: false, message: 'Entered OTP is incorrect' });
    const done = await post(desk, `${LOGINS}/${journeyId}/mobile-update/verify`, {
      otp: RIGHT_OTP,
    }).expect(200);
    expect(done.body.data).toEqual({
      verified: true,
      message: 'Mobile Number linked successfully',
    });
    const profile = await desk.agent.get(`${JOURNEYS}/${journeyId}/profile`).expect(200);
    expect(profile.body.data.mobile).toBe('0000000088');
    abdm.mobile = ABHA_MOBILE;
  });
});

describe('login with an ABHA address', () => {
  it('offers exactly the methods the search lists', async () => {
    abdm.addressMethods = ['AADHAAR_OTP', 'MOBILE_OTP', 'PASSWORD'];
    const both = await post(desk, `${LOGINS}/address-methods`, {
      abhaAddress: ABHA_ADDRESS,
    }).expect(200);
    expect(both.body.data).toEqual({
      methods: ['AADHAAR_OTP', 'MOBILE_OTP'],
      offeredByAbdm: ['AADHAAR_OTP', 'MOBILE_OTP', 'PASSWORD'],
    });
    abdm.addressMethods = ['MOBILE_OTP'];
    const one = await post(desk, `${LOGINS}/address-methods`, { abhaAddress: ABHA_ADDRESS }).expect(
      200,
    );
    expect(one.body.data.methods).toEqual(['MOBILE_OTP']);
    abdm.addressMethods = ['AADHAAR_OTP', 'MOBILE_OTP'];
  });

  it('logs in on the address routes and reads the profile and card with that login’s token', async () => {
    const journeyId = await login({
      identifier: 'ABHA_ADDRESS',
      value: ABHA_ADDRESS,
      method: 'MOBILE_OTP',
      deskMobile: '0000000088',
    });
    expect(lastCall('/abha/request/otp')?.body).toMatchObject({
      scope: ['abha-address-login', 'mobile-verify'],
      loginHint: 'abha-address',
    });
    const profile = await desk.agent.get(`${JOURNEYS}/${journeyId}/profile`).expect(200);
    expect(profile.body.data.abhaNumber).toBe(ABHA_NUMBER);
    expect(lastCall('/profile/abha-profile')?.headers['X-token']).toBe(
      'Bearer user-token-for-address',
    );
    await desk.agent.get(`${JOURNEYS}/${journeyId}/card`).expect(200);
    expect(lastCall('/abha/phr-card')?.headers['X-token']).toBe('Bearer user-token-for-address');

    const view = await post(
      desk,
      `${LOGINS}/${(await post(desk, LOGINS, { identifier: 'ABHA_ADDRESS', value: ABHA_ADDRESS, method: 'AADHAAR_OTP', deskMobile: '0000000088' }).expect(201)).body.data.journeyId as string}/verify`,
      { otp: RIGHT_OTP },
    ).expect(200);
    expect(view.body.data.mobileUpdate).toBe('NOT_AVAILABLE');
    // No published call updates the mobile with an ABHA-address login's token.
    const refused = await post(desk, `${LOGINS}/${journeyId}/mobile-update`, {
      mobile: '0000000088',
    }).expect(409);
    expect(refused.body.detail).toContain('cannot be updated from an ABHA address login');
  });
});

describe('login with an Aadhaar number', () => {
  const start = {
    identifier: 'AADHAAR',
    value: AADHAAR,
    beneficiaryName: 'Login Person',
    consent: CONSENT,
  };

  it('refuses an invalid number and a missing consent without calling ABDM', async () => {
    const before = abdm.calls.length;
    const invalid = await post(desk, LOGINS, { ...start, value: '1234' }).expect(400);
    expect(JSON.stringify(invalid.body)).toContain(ABHA_TEXT.aadhaarInvalid);
    await post(desk, LOGINS, { ...start, consent: { ...CONSENT, termsAgreed: false } }).expect(400);
    await post(desk, LOGINS, { identifier: 'AADHAAR', value: AADHAAR }).expect(400);
    expect(abdm.calls.length).toBe(before);
  });

  it('records consent, never keeps the number, and shows the ABHA the Aadhaar holds', async () => {
    const started = await post(desk, LOGINS, start).expect(201);
    const journeyId = started.body.data.journeyId as string;
    expect(started.body.data.message).toContain('******0077');
    expect(lastCall('/login/request/otp')?.body).toMatchObject({
      loginHint: 'aadhaar',
      otpSystem: 'aadhaar',
    });
    const consent = await db.auditEvent.findFirst({
      where: {
        resourceType: 'AbhaEnrolmentConsent',
        resourceId: journeyId,
        action: 'CONSENT_GRANT',
      },
    });
    expect(consent).not.toBeNull();
    const stored = await app.get(RedisService).client.get(`abha:journey:${journeyId}`);
    expect(stored).not.toContain(AADHAAR);
    expect(JSON.stringify(abdm.calls)).not.toContain(AADHAAR);

    const verified = await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(
      200,
    );
    expect(verified.body.data).toMatchObject({
      outcome: 'VERIFIED',
      profile: { abhaNumber: ABHA_NUMBER },
    });
    await desk.agent.get(`${JOURNEYS}/${journeyId}/card`).expect(200);
  });

  it('answers "no ABHA" with ABDM’s message as an outcome, so creation can be offered', async () => {
    abdm.noAbha = true;
    const started = await post(desk, LOGINS, start).expect(201);
    const journeyId = started.body.data.journeyId as string;
    const verified = await post(desk, `${LOGINS}/${journeyId}/verify`, { otp: RIGHT_OTP }).expect(
      200,
    );
    abdm.noAbha = false;
    expect(verified.body.data).toEqual({
      journeyId,
      outcome: 'NO_ABHA',
      message: 'No ABHA user registered with this Aadhaar number.',
      profile: null,
      accounts: 0,
      mobileUpdate: 'NOT_NEEDED',
    });
    await desk.agent.get(`${JOURNEYS}/${journeyId}/profile`).expect(409);
  });

  it('treats "user not found" on an ABHA number as a refusal, not as an offer to create', async () => {
    abdm.noAbha = true;
    const started = await post(desk, LOGINS, {
      identifier: 'ABHA_NUMBER',
      value: ABHA_NUMBER,
      method: 'MOBILE_OTP',
    }).expect(201);
    const refused = await post(desk, `${LOGINS}/${started.body.data.journeyId as string}/verify`, {
      otp: RIGHT_OTP,
    }).expect(422);
    abdm.noAbha = false;
    expect(refused.body).toMatchObject({ code: 'ABDM_REFUSED', reason: 'ABDM-1114' });
  });
});

describe('who may log a patient in', () => {
  it('is closed to demo organizations, doctors and patients', async () => {
    const before = abdm.calls.length;
    const body = { identifier: 'ABHA_NUMBER', value: ABHA_NUMBER, method: 'MOBILE_OTP' };
    await post(await signIn(app, EMAIL.care), LOGINS, body).expect(403);
    await post(await signIn(app, EMAIL.doctor), LOGINS, body).expect(403);
    await post(await signIn(app, EMAIL.patient), LOGINS, body).expect(403);
    await post(await signIn(app, EMAIL.care), `${LOGINS}/address-methods`, {
      abhaAddress: ABHA_ADDRESS,
    }).expect(403);
    expect(abdm.calls.length).toBe(before);
  });
});
