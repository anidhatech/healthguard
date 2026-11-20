/**
 * Create ABHA by Aadhaar OTP, through the real API against a fake ABDM. The
 * fake answers with the response shapes observed in the sandbox on 2026-11-19.
 * Every identity here is made up; nothing leaves the machine.
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

const CLINIC = '019f0000-0000-7000-8000-0000000ab4a0';
const DESK_USER = '019f0000-0000-7000-8000-0000000ab4a1';
const OTHER_USER = '019f0000-0000-7000-8000-0000000ab4a2';
// Test-only, for a user this file creates and deletes. Same value as the registration test.
const PASSWORD = 'Registration-Test-2026';
const AADHAAR = '000000000000';
const ABHA_NUMBER = '91-0000-0000-0042';
const LINKED_MOBILE = '0000000042';
const RIGHT_OTP = '123456';

const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

interface FakeCall {
  path: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

/** What the fake ABDM holds, so a test can change the person or count the calls. */
const abdm = {
  calls: [] as FakeCall[],
  isNew: false,
  takenAddresses: new Set<string>(['taken.name@sbx']),
  profileMobile: LINKED_MOBILE,
  addresses: ['test.person@sbx'],
  aadhaarSends: 0,
};

function profile() {
  return {
    ABHANumber: ABHA_NUMBER,
    preferredAddress: abdm.addresses[0],
    phrAddress: abdm.addresses,
    firstName: 'Test',
    middleName: '',
    lastName: 'Person',
    dob: '01-01-1980',
    gender: 'F',
    photo: 'aGk=',
    mobile: abdm.profileMobile,
    mobileVerified: true,
    pinCode: '500001',
    abhaType: 'STANDARD',
    stateName: 'Telangana',
    districtName: 'Hyderabad',
    communicationMobile: null,
    abhaStatus: 'ACTIVE',
  };
}

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
  abdm.calls.push({ path, method: init?.method ?? 'GET', body });
  // The fake cannot decrypt, so a test marks a wrong OTP by its transaction id.
  const otp = (body?.authData as { otp?: { txnId?: string } } | undefined)?.otp;
  if (path.endsWith('/enrollment/request/otp')) {
    const mobile = body?.loginHint === 'mobile';
    // Like the sandbox: a resend that carries a transaction id is refused with a
    // bare 400, and every fresh Aadhaar send returns a new id.
    if (!mobile && body?.txnId) return json({ txnId: 'x', timestamp: '2026-11-20 00:32:32' }, 400);
    if (!mobile) abdm.aadhaarSends += 1;
    return json({
      txnId: mobile ? 'txn-mobile' : `txn-aadhaar-${abdm.aadhaarSends}`,
      message: mobile
        ? 'OTP sent to mobile number ending with ******0099'
        : 'OTP sent to Aadhaar registered mobile number ending with ******0042',
    });
  }
  if (path.endsWith('/enrol/byAadhaar')) {
    if (wrongOtp.next) {
      wrongOtp.next = false;
      return json(
        { code: 'ABDM-1204', message: 'UIDAI Error code : 400 : Invalid Aadhaar OTP value.' },
        422,
      );
    }
    return json({
      message: abdm.isNew ? 'Account created successfully' : 'This account already exist',
      txnId: otp?.txnId,
      tokens: { token: 'user-token', expiresIn: 1800, refreshToken: 'refresh-token' },
      ABHAProfile: profile(),
      isNew: abdm.isNew,
    });
  }
  if (path.endsWith('/auth/byAbdm')) {
    if (wrongOtp.next) {
      wrongOtp.next = false;
      return json({ txnId: otp?.txnId, authResult: 'Failed', message: 'Invalid OTP' });
    }
    abdm.profileMobile = '0000000099';
    return json({
      txnId: otp?.txnId,
      authResult: 'success',
      message: 'Mobile number is now successfully linked to your Account',
      accounts: [{ ABHANumber: ABHA_NUMBER }],
    });
  }
  if (path.endsWith('/enrol/suggestion')) {
    return json({
      txnId: 'txn-aadhaar',
      abhaAddressList: ['test.person80', 'test_person', 'testperson1980'],
    });
  }
  if (path.endsWith('/enrol/abha-address')) {
    const address = `${String(body?.abhaAddress)}@sbx`;
    if (abdm.takenAddresses.has(address)) {
      return json({ code: 'ABDM-1100', message: 'ABHA address already exists.' }, 422);
    }
    abdm.addresses = [address, ...abdm.addresses];
    return json({
      txnId: 'txn-aadhaar',
      healthIdNumber: ABHA_NUMBER,
      preferredAbhaAddress: address,
    });
  }
  if (path.endsWith('/profile/account')) {
    return json({
      ABHANumber: ABHA_NUMBER,
      preferredAbhaAddress: abdm.addresses[0],
      mobile: abdm.profileMobile,
      firstName: 'Test',
      lastName: 'Person',
      name: 'Test Person',
      yearOfBirth: '1980',
      monthOfBirth: '01',
      dayOfBirth: '01',
      gender: 'F',
      status: 'ACTIVE',
      kycVerified: true,
    });
  }
  if (path.endsWith('/profile/account/abha-card')) {
    return Promise.resolve(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), {
        status: 202,
        headers: { 'content-type': 'image/png' },
      }),
    );
  }
  return Promise.reject(new Error(`fake ABDM has no answer for ${path}`));
}) as typeof fetch;
const wrongOtp = { next: false };

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
const START = { aadhaarNumber: AADHAAR, beneficiaryName: 'Test Person', consent: CONSENT };
const BASE = '/api/v1/abha/enrolments';

let app: INestApplication;
let desk: Session;

async function passwordSignIn(email: string): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const csrf =
    cookies
      .find((cookie) => cookie.startsWith('hg_csrf='))
      ?.split(';')[0]
      ?.split('=')[1] ?? '';
  return { agent, csrf };
}

const post = (session: Session, path: string, body?: object) =>
  session.agent
    .post(`${BASE}${path}`)
    .set('X-CSRF-Token', session.csrf)
    .send(body ?? {});

async function begin(): Promise<string> {
  const started = await post(desk, '', START).expect(201);
  return started.body.data.journeyId as string;
}

async function enrol(mobile = LINKED_MOBILE): Promise<string> {
  const journeyId = await begin();
  await post(desk, `/${journeyId}/verify`, { otp: RIGHT_OTP, mobile }).expect(200);
  return journeyId;
}

async function removeClinic(): Promise<void> {
  await db.authSession.deleteMany({
    where: { OR: [{ userId: { in: [DESK_USER, OTHER_USER] } }, { activeOrganizationId: CLINIC }] },
  });
  await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
  await db.organizationMember.deleteMany({ where: { organizationId: CLINIC } });
  await db.user.deleteMany({ where: { id: { in: [DESK_USER, OTHER_USER] } } });
  await db.organization.deleteMany({ where: { id: CLINIC } });
}

beforeAll(async () => {
  await removeClinic();
  app = await startApp([{ provide: ABDM_GATEWAY, useValue: gateway }]);
  await resetTo(app, 0);
  await db.organization.create({
    data: {
      id: CLINIC,
      slug: 'abha-test-clinic',
      name: 'ABHA Test Clinic',
      type: 'CLINIC',
      isDemo: false,
    },
  });
  const passwordHash = await hash(PASSWORD);
  for (const [id, email] of [
    [DESK_USER, 'desk@abha-clinic.test'],
    [OTHER_USER, 'nurse@abha-clinic.test'],
  ] as const) {
    await db.user.create({ data: { id, email, displayName: email, passwordHash } });
    await db.organizationMember.create({
      data: {
        organizationId: CLINIC,
        userId: id,
        roles: [id === DESK_USER ? 'FRONT_DESK' : 'NURSE'],
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
  }
  desk = await passwordSignIn('desk@abha-clinic.test');
});

afterAll(async () => {
  vi.useRealTimers();
  await removeClinic();
  await app.close();
});

describe('consent and the Aadhaar OTP', () => {
  it('sends nothing to ABDM until every consent box is in, and says why the number is refused', async () => {
    abdm.calls.length = 0;
    const invalid = await post(desk, '', { ...START, aadhaarNumber: '12345' }).expect(400);
    expect(JSON.stringify(invalid.body)).toContain(ABHA_TEXT.aadhaarInvalid);
    await post(desk, '', { ...START, aadhaarNumber: '12345678901a' }).expect(400);
    await post(desk, '', { ...START, consent: { ...CONSENT, termsAgreed: false } }).expect(400);
    await post(desk, '', { ...START, consent: { ...CONSENT, beneficiaryConfirmed: false } }).expect(
      400,
    );
    await post(desk, '', { ...START, consent: { ...CONSENT, otherDocument: true } }).expect(400);
    expect(abdm.calls).toHaveLength(0);
  });

  it('records the consent, sends the OTP and shows ABDM’s own message', async () => {
    abdm.calls.length = 0;
    const started = await post(desk, '', START).expect(201);

    expect(started.body.data).toMatchObject({
      message: 'OTP sent to Aadhaar registered mobile number ending with ******0042',
      resendsLeft: 2,
    });
    expect(abdm.calls).toHaveLength(1);
    expect(JSON.stringify(abdm.calls[0]?.body)).not.toContain(AADHAAR);
    const journeyId = started.body.data.journeyId as string;
    const consent = await db.auditEvent.findFirst({
      where: {
        resourceType: 'AbhaEnrolmentConsent',
        resourceId: journeyId,
        action: 'CONSENT_GRANT',
      },
    });
    expect(consent).toMatchObject({ organizationId: CLINIC, actorUserId: DESK_USER });
    expect(JSON.stringify(consent?.metadata)).toContain('"termsVersion":"1.4"');
    // Neither the audit trail nor the journey state ever holds the Aadhaar number.
    expect(JSON.stringify(consent)).not.toContain(AADHAAR);
    const stored = await app.get(RedisService).client.get(`abha:journey:${journeyId}`);
    expect(stored).not.toContain(AADHAAR);
  });

  it('allows a resend only after 60 seconds, and only twice', async () => {
    const journeyId = await begin();
    abdm.calls.length = 0;
    const resend = () => post(desk, `/${journeyId}/resend`, { aadhaarNumber: AADHAAR });

    const early = await resend().expect(409);
    expect(early.body.detail).toMatch(/available in \d+ seconds/);
    expect(abdm.calls).toHaveLength(0);

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 61_000);
      const first = await resend().expect(200);
      expect(first.body.data.resendsLeft).toBe(1);
      // A resend is a fresh send, never one that carries the first transaction id.
      expect(abdm.calls[0]?.body?.txnId).toBe('');
      vi.setSystemTime(Date.now() + 61_000);
      expect((await resend().expect(200)).body.data.resendsLeft).toBe(0);
      vi.setSystemTime(Date.now() + 61_000);
      const third = await resend().expect(409);
      expect(third.body.detail).toBe(ABHA_TEXT.resendLimit);
      expect(abdm.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
    // The OTP is then verified against the newest transaction, not the first.
    await post(desk, `/${journeyId}/verify`, { otp: RIGHT_OTP, mobile: LINKED_MOBILE }).expect(200);
    const verify = abdm.calls.at(-1)?.body?.authData as { otp: { txnId: string } };
    expect(verify.otp.txnId).toBe(`txn-aadhaar-${abdm.aadhaarSends}`);
  });

  it('keeps the transaction after a wrong OTP and passes on ABDM’s message unchanged', async () => {
    const journeyId = await begin();
    abdm.calls.length = 0;
    await post(desk, `/${journeyId}/verify`, { otp: '12345', mobile: LINKED_MOBILE }).expect(400);
    expect(abdm.calls).toHaveLength(0);

    wrongOtp.next = true;
    const refused = await post(desk, `/${journeyId}/verify`, {
      otp: '000000',
      mobile: LINKED_MOBILE,
    }).expect(422);
    expect(refused.body).toMatchObject({
      code: 'ABDM_REFUSED',
      detail: 'UIDAI Error code : 400 : Invalid Aadhaar OTP value.',
      reason: 'ABDM-1204',
    });

    const verified = await post(desk, `/${journeyId}/verify`, {
      otp: RIGHT_OTP,
      mobile: LINKED_MOBILE,
    }).expect(200);
    const otps = abdm.calls.map(
      (call) => (call.body?.authData as { otp: { txnId: string } }).otp.txnId,
    );
    expect(otps).toHaveLength(2);
    expect(new Set(otps).size).toBe(1);
    expect(otps[0]).toBe(`txn-aadhaar-${abdm.aadhaarSends}`);
    expect(verified.body.data).toMatchObject({
      isNew: false,
      message: 'This account already exist',
      mobileVerificationRequired: false,
      profile: {
        abhaNumber: ABHA_NUMBER,
        name: 'Test Person',
        preferredAbhaAddress: 'test.person@sbx',
      },
    });
  });
});

describe('the communication mobile', () => {
  it('goes straight on when it is the Aadhaar-linked mobile', async () => {
    const journeyId = await begin();
    const verified = await post(desk, `/${journeyId}/verify`, {
      otp: RIGHT_OTP,
      mobile: LINKED_MOBILE,
    }).expect(200);
    expect(verified.body.data.mobileVerificationRequired).toBe(false);
  });

  it('asks for an OTP when it differs, and the profile then shows that mobile', async () => {
    abdm.profileMobile = LINKED_MOBILE;
    const journeyId = await begin();
    const verified = await post(desk, `/${journeyId}/verify`, {
      otp: RIGHT_OTP,
      mobile: '0000000099',
    }).expect(200);
    expect(verified.body.data.mobileVerificationRequired).toBe(true);

    await post(desk, `/${journeyId}/mobile-otp/verify`, { otp: RIGHT_OTP }).expect(409);
    const sent = await post(desk, `/${journeyId}/mobile-otp`).expect(200);
    expect(sent.body.data.message).toBe('OTP sent to mobile number ending with ******0099');
    expect((await post(desk, `/${journeyId}/mobile-otp`).expect(409)).body.detail).toMatch(
      /available in/,
    );

    wrongOtp.next = true;
    const wrong = await post(desk, `/${journeyId}/mobile-otp/verify`, { otp: '000000' }).expect(
      200,
    );
    expect(wrong.body.data).toEqual({ verified: false, message: 'Invalid OTP' });
    const right = await post(desk, `/${journeyId}/mobile-otp/verify`, { otp: RIGHT_OTP }).expect(
      200,
    );
    expect(right.body.data.verified).toBe(true);

    const shown = await desk.agent.get(`${BASE}/${journeyId}/profile`).expect(200);
    expect(shown.body.data).toMatchObject({
      mobile: '0000000099',
      dateOfBirth: '01-01-1980',
      kycVerified: true,
    });
    abdm.profileMobile = LINKED_MOBILE;
  });
});

describe('the ABHA address, the profile and the card', () => {
  it('offers at least three suggestions and creates the chosen address', async () => {
    const journeyId = await enrol();
    const suggested = await desk.agent.get(`${BASE}/${journeyId}/address-suggestions`).expect(200);
    expect(suggested.body.data.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggested.body.data.suffix).toBe('@sbx');

    const created = await post(desk, `/${journeyId}/address`, {
      abhaAddress: 'test.person80',
    }).expect(200);
    expect(created.body.data.preferredAbhaAddress).toBe('test.person80@sbx');
  });

  it('says so when an address is already in use', async () => {
    const journeyId = await enrol();
    const taken = await post(desk, `/${journeyId}/address`, { abhaAddress: 'taken.name' }).expect(
      422,
    );
    expect(taken.body).toMatchObject({ code: 'ABDM_REFUSED', detail: ABHA_TEXT.addressExists });
  });

  it('returns the card as ABDM sent it, to view or to download', async () => {
    const journeyId = await enrol();
    const card = await desk.agent.get(`${BASE}/${journeyId}/card`).buffer(true).expect(200);
    expect(card.headers['content-type']).toBe('image/png');
    expect(card.headers['content-disposition']).toContain('inline');
    expect(
      Buffer.from(card.body as Buffer)
        .subarray(0, 4)
        .toString('latin1'),
    ).toBe('\x89PNG');
    const download = await desk.agent.get(`${BASE}/${journeyId}/card?download=1`).expect(200);
    expect(download.headers['content-disposition']).toContain('attachment');
  });
});

describe('saving to the facility’s record', () => {
  it('creates one patient, then finds that patient for the same ABHA instead of a second', async () => {
    const journeyId = await enrol();
    const none = await desk.agent.get(`${BASE}/${journeyId}/matches`).expect(200);
    expect(none.body.data).toEqual({ matches: [], mayCreate: true });

    const saved = await post(desk, `/${journeyId}/save`, {
      action: 'CREATE',
      preferredLocale: 'te-IN',
    }).expect(200);
    expect(saved.body.data).toMatchObject({
      status: 'CREATED',
      patient: { displayName: 'Test Person', abhaLinked: true },
    });
    const patientId = saved.body.data.patient.id as string;
    const row = await db.patientProfile.findUniqueOrThrow({ where: { id: patientId } });
    expect(row).toMatchObject({
      abhaNumber: '91000000000042',
      abhaAddress: abdm.addresses[0],
      sex: 'FEMALE',
      phone: LINKED_MOBILE,
      isSynthetic: false,
      preferredLocale: 'te-IN',
    });
    expect(row.dateOfBirth.toISOString().slice(0, 10)).toBe('1980-01-01');
    const linkedConsent = await db.auditEvent.findFirst({
      where: {
        resourceType: 'AbhaEnrolmentConsent',
        resourceId: journeyId,
        patientProfileId: patientId,
      },
    });
    expect(linkedConsent).not.toBeNull();

    const again = await enrol();
    const found = await desk.agent.get(`${BASE}/${again}/matches`).expect(200);
    expect(found.body.data).toMatchObject({
      mayCreate: false,
      matches: [{ patientId, reason: 'ABHA_NUMBER', abhaLinked: true }],
    });
    const second = await post(desk, `/${again}/save`, { action: 'CREATE' }).expect(200);
    expect(second.body.data).toMatchObject({ status: 'EXISTING', patient: { id: patientId } });
    expect(await db.patientProfile.count({ where: { organizationId: CLINIC } })).toBe(1);
  });

  it('matches a registered patient on mobile, name, gender and year of birth, and links instead of creating', async () => {
    await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
    const existing = await db.patientProfile.create({
      data: {
        organizationId: CLINIC,
        mrn: 'ATC-000777',
        givenName: 'test',
        familyName: 'PERSON',
        dateOfBirth: new Date('1980-06-15T00:00:00Z'),
        sex: 'FEMALE',
        phone: `+91${LINKED_MOBILE}`,
        dailyRoutine: {},
      },
    });
    const journeyId = await enrol();
    const found = await desk.agent.get(`${BASE}/${journeyId}/matches`).expect(200);
    expect(found.body.data).toMatchObject({
      mayCreate: false,
      matches: [{ patientId: existing.id, reason: 'DEMOGRAPHICS', abhaLinked: false }],
    });
    await post(desk, `/${journeyId}/save`, { action: 'CREATE' }).expect(409);

    const linked = await post(desk, `/${journeyId}/save`, {
      action: 'LINK',
      patientId: existing.id,
    }).expect(200);
    expect(linked.body.data.patient).toMatchObject({ id: existing.id, abhaLinked: true });
    expect(await db.patientProfile.count({ where: { organizationId: CLINIC } })).toBe(1);
  });

  it('finds a patient by the record number they give', async () => {
    await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
    const other = await db.patientProfile.create({
      data: {
        organizationId: CLINIC,
        mrn: 'ATC-000888',
        givenName: 'Someone',
        dateOfBirth: new Date('1970-01-01T00:00:00Z'),
        sex: 'FEMALE',
        dailyRoutine: {},
      },
    });
    const journeyId = await enrol();
    const found = await desk.agent.get(`${BASE}/${journeyId}/matches?mrn=atc-000888`).expect(200);
    expect(found.body.data).toMatchObject({
      mayCreate: true,
      matches: [{ patientId: other.id, reason: 'RECORD_NUMBER' }],
    });
  });
});

describe('who may use a journey', () => {
  it('is closed to another staff member, to doctors and patients, and to demo organizations', async () => {
    const journeyId = await enrol();
    const nurse = await passwordSignIn('nurse@abha-clinic.test');
    await nurse.agent.get(`${BASE}/${journeyId}/profile`).expect(404);
    await post(nurse, `/${journeyId}/save`, { action: 'CREATE' }).expect(404);

    const care = await signIn(app, EMAIL.care);
    abdm.calls.length = 0;
    await post(care, '', START).expect(403);
    expect(abdm.calls).toHaveLength(0);
    const doctor = await signIn(app, EMAIL.doctor);
    await post(doctor, '', START).expect(403);
    const patient = await signIn(app, EMAIL.patient);
    await post(patient, '', START).expect(403);
  });

  it('reads an unknown or expired journey as not found', async () => {
    await desk.agent.get(`${BASE}/019f0000-0000-7000-8000-00000000dead/profile`).expect(404);
  });
});
