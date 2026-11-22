/**
 * Scan and share at a counter, through the real API against a fake ABDM.
 * Every identity here is made up; nothing leaves the machine.
 */
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Read when the harness builds its configuration, so it is set before that import runs.
vi.hoisted(() => {
  process.env.ABDM_SHARE_INBOUND = 'on';
});

import { buildConfig } from '../src/config/env.js';
import { ABDM_GATEWAY, createAbdmGateway } from '../src/modules/abdm/abdm.module.js';
import { ShareService } from '../src/modules/counters/share.service.js';
import { db, resetTo, startApp, type Session } from './harness.js';

const CLINIC = '019f0000-0000-7000-8000-0000000107a0';
const DESK_USER = '019f0000-0000-7000-8000-0000000107a1';
// Test-only, for a user this file creates and deletes. Same value as the registration test.
const PASSWORD = 'Registration-Test-2026';
const FACILITY = 'IN0000000107';
const SHARE = '/api/v3/hip/patient/share';
const COUNTERS = '/api/v1/counters';

interface OnShare {
  headers: Record<string, string>;
  body: {
    acknowledgement: {
      status: string;
      abhaAddress: string;
      profile: { context: string; tokenNumber: string; expiry: string };
    };
    response: { requestId: string };
  };
}
const abdm = { replies: [] as OnShare[], refuse: false };

const fakeFetch = ((url: string | URL, init?: RequestInit) => {
  const path = new URL(url.toString()).pathname;
  if (path.endsWith('/sessions')) {
    return Promise.resolve(Response.json({ accessToken: 'gateway-token', expiresIn: 1200 }));
  }
  if (path.endsWith('/patient-share/v3/on-share')) {
    if (abdm.refuse) return Promise.resolve(Response.json({ message: 'refused' }, { status: 400 }));
    abdm.replies.push({
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as OnShare['body'],
    });
    return Promise.resolve(new Response(null, { status: 202 }));
  }
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

let app: INestApplication;
let share: ShareService;
let desk: Session;
let scans = 0;

const profile = (over: Record<string, unknown> = {}) => ({
  abhaNumber: '91-0000-0000-0107',
  abhaAddress: 'share.person@sbx',
  name: 'Share Person',
  gender: 'F',
  dayOfBirth: '7',
  monthOfBirth: '2',
  yearOfBirth: '1988',
  phoneNumber: '0000000107',
  address: {
    line: '9 Sample Road',
    district: 'Hyderabad',
    state: 'Telangana',
    pincode: '500009',
  },
  ...over,
});

/** One scan: the share ABDM would post, handled to the end so the test can look. */
async function scan(context: string, patient: Record<string, unknown> = {}, hipId = FACILITY) {
  scans += 1;
  const requestId = `00000000-0000-4000-8000-${String(scans).padStart(12, '0')}`;
  const outcome = await share.process(requestId, {
    intent: 'PROFILE_SHARE',
    metaData: { hipId, context },
    profile: { patient: profile(patient) },
  });
  return { requestId, outcome };
}

const post = (url: string, body?: object) =>
  desk.agent
    .post(url)
    .set('X-CSRF-Token', desk.csrf)
    .send(body ?? {});
const patients = () => db.patientProfile.findMany({ where: { organizationId: CLINIC } });
const entries = (where: object = {}) =>
  db.queueEntry.findMany({ where: { organizationId: CLINIC, ...where } });

async function removeClinic(): Promise<void> {
  await db.authSession.deleteMany({
    where: { OR: [{ userId: DESK_USER }, { activeOrganizationId: CLINIC }] },
  });
  await db.queueEntry.deleteMany({ where: { organizationId: CLINIC } });
  await db.counter.deleteMany({ where: { organizationId: CLINIC } });
  await db.patientProfile.deleteMany({ where: { organizationId: CLINIC } });
  await db.organizationMember.deleteMany({ where: { organizationId: CLINIC } });
  await db.user.deleteMany({ where: { id: DESK_USER } });
  await db.organization.deleteMany({ where: { id: CLINIC } });
}

beforeAll(async () => {
  await removeClinic();
  app = await startApp([{ provide: ABDM_GATEWAY, useValue: gateway }]);
  share = app.get(ShareService);
  await resetTo(app, 0);
  await db.organization.create({
    data: {
      id: CLINIC,
      slug: 'share-test-clinic',
      name: 'Share Test Clinic',
      type: 'CLINIC',
      isDemo: false,
      hfrId: FACILITY,
    },
  });
  await db.user.create({
    data: {
      id: DESK_USER,
      email: 'desk@share-clinic.test',
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
    .send({ email: 'desk@share-clinic.test', password: PASSWORD })
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
  await removeClinic();
  await app.close();
});

describe('counters', () => {
  it('are added by the desk and carry the QR address ABDM expects', async () => {
    await post(COUNTERS, { code: 'OPD 1', name: 'Bad' }).expect(400);
    await post(COUNTERS, { code: FACILITY, name: 'Bad' }).expect(400);
    const created = await post(COUNTERS, { code: 'OPD1', name: 'Out-patient desk' }).expect(201);
    expect(created.body.data.qrUrl).toBe(
      `https://phrsbx.abdm.gov.in/share-profile?hip-id=${FACILITY}&counter-id=OPD1`,
    );
    await post(COUNTERS, { code: 'opd1', name: 'Again' }).expect(409);
    await post(COUNTERS, { code: 'LAB1', name: 'Laboratory' }).expect(201);
    const list = await desk.agent.get(COUNTERS).expect(200);
    expect(list.body.data).toMatchObject({ facilityId: FACILITY, sharingOn: true });
    expect(list.body.data.counters).toHaveLength(2);
  });
});

describe('a profile shared at a counter', () => {
  it('is acknowledged at once on the address ABDM posts to, with no session', async () => {
    await request(app.getHttpServer())
      .post(SHARE)
      .set('REQUEST-ID', '00000000-0000-4000-8000-0000000000aa')
      .send({ intent: 'PROFILE_SHARE', metaData: { hipId: 'IN9999999999', context: 'OPD1' } })
      .expect(200);
  });

  it('ignores a facility or a counter it does not know, and registers nobody', async () => {
    expect((await scan('OPD1', {}, 'IN9999999999')).outcome).toEqual({
      status: 'IGNORED',
      reason: 'UNKNOWN_FACILITY',
    });
    expect((await scan('NOPE')).outcome).toEqual({ status: 'IGNORED', reason: 'UNKNOWN_COUNTER' });
    expect((await share.process('x', { metaData: {} })).status).toBe('IGNORED');
    expect(await patients()).toHaveLength(0);
    expect(abdm.replies).toHaveLength(0);
  });

  it('registers a new patient with nothing typed, queues them, and replies with the token', async () => {
    const { requestId, outcome } = await scan('OPD1');
    expect(outcome).toMatchObject({
      status: 'QUEUED',
      patient: 'CREATED',
      entry: 'CREATED',
      tokenNumber: 1,
      replied: true,
    });
    const [row] = await patients();
    expect(row).toMatchObject({
      givenName: 'Share',
      familyName: 'Person',
      sex: 'FEMALE',
      phone: '0000000107',
      abhaNumber: '91000000000107',
      abhaAddress: 'share.person@sbx',
      addressLine: '9 Sample Road',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500009',
      isSynthetic: false,
    });
    expect(row?.dateOfBirth.toISOString().slice(0, 10)).toBe('1988-02-07');
    const reply = abdm.replies.at(-1);
    expect(reply?.headers['X-HIP-ID']).toBe(FACILITY);
    expect(reply?.body).toEqual({
      acknowledgement: {
        status: 'SUCCESS',
        abhaAddress: 'share.person@sbx',
        profile: { context: 'OPD1', tokenNumber: '1', expiry: '3600' },
      },
      response: { requestId },
    });
    const audit = await db.auditEvent.findFirst({
      where: { organizationId: CLINIC, resourceType: 'PatientProfile', action: 'CREATE' },
    });
    expect(audit?.actorType).toBe('SYSTEM');
    const queue = await desk.agent
      .get(`${COUNTERS}/${(await entries())[0]?.counterId}/queue`)
      .expect(200);
    expect(queue.body.data[0]).toMatchObject({
      tokenNumber: 1,
      replyStatus: 'SENT',
      patient: { displayName: 'Share Person' },
    });
  });

  it('keeps one queue entry and its token when the same person scans the same counter again', async () => {
    const { outcome } = await scan('OPD1');
    expect(outcome).toMatchObject({ patient: 'MATCHED', entry: 'REUSED', tokenNumber: 1 });
    expect(await entries()).toHaveLength(1);
    expect(await patients()).toHaveLength(1);
    expect(abdm.replies.at(-1)?.body.acknowledgement.profile.tokenNumber).toBe('1');
  });

  it('opens a new entry on another counter, for the same patient', async () => {
    const { outcome } = await scan('LAB1');
    expect(outcome).toMatchObject({ patient: 'MATCHED', entry: 'CREATED', tokenNumber: 1 });
    expect(abdm.replies.at(-1)?.body.acknowledgement.profile.context).toBe('LAB1');
    expect(await entries({ status: 'ACTIVE' })).toHaveLength(2);
    expect(await patients()).toHaveLength(1);
  });

  it('reuses the record on a revisit after the entry is closed, with the next token', async () => {
    const opd = (await entries()).find(
      (row) => row.tokenNumber === 1 && row.replyStatus === 'SENT',
    );
    const list = await desk.agent.get(COUNTERS).expect(200);
    const opdCounter = (list.body.data.counters as { id: string; code: string }[]).find(
      (row) => row.code === 'OPD1',
    );
    const waiting = await desk.agent.get(`${COUNTERS}/${opdCounter?.id}/queue`).expect(200);
    await post(`${COUNTERS}/queue/${waiting.body.data[0].id as string}/close`).expect(204);
    expect(opd).toBeDefined();
    const { outcome } = await scan('OPD1');
    expect(outcome).toMatchObject({ patient: 'MATCHED', entry: 'CREATED', tokenNumber: 2 });
    expect(await patients()).toHaveLength(1);
  });

  it('updates the ABHA address when the same person shares from another of theirs', async () => {
    const { outcome } = await scan('OPD1', { abhaAddress: 'share.person.two@sbx' });
    expect(outcome).toMatchObject({ patient: 'MATCHED', entry: 'REUSED' });
    const rows = await patients();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.abhaAddress).toBe('share.person.two@sbx');
    expect(abdm.replies.at(-1)?.body.acknowledgement.abhaAddress).toBe('share.person.two@sbx');
  });

  it('links the ABHA to a patient the desk registered by hand, matched on name, gender and mobile', async () => {
    await post('/api/v1/patients', {
      givenName: 'Manual',
      familyName: 'Entry',
      dateOfBirth: '1970-01-01',
      sex: 'MALE',
      phone: '0000000555',
    }).expect(201);
    const { outcome } = await scan('OPD1', {
      abhaNumber: '91-0000-0000-0555',
      abhaAddress: 'manual.entry@sbx',
      name: 'manual  entry',
      gender: 'M',
      phoneNumber: '+910000000555',
    });
    expect(outcome).toMatchObject({ patient: 'MATCHED', entry: 'CREATED', tokenNumber: 3 });
    const rows = await patients();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.givenName === 'Manual')).toMatchObject({
      abhaNumber: '91000000000555',
      abhaAddress: 'manual.entry@sbx',
    });
  });

  it('keeps the patient queued and marks the reply failed when ABDM refuses it', async () => {
    abdm.refuse = true;
    const { outcome } = await scan('LAB1', {
      abhaNumber: '91-0000-0000-0999',
      abhaAddress: 'third.person@sbx',
      name: 'Third Person',
      phoneNumber: '0000000999',
      dayOfBirth: undefined,
      monthOfBirth: undefined,
    });
    abdm.refuse = false;
    expect(outcome).toMatchObject({ patient: 'CREATED', replied: false });
    const third = (await patients()).find((row) => row.givenName === 'Third');
    // Only a year of birth was shared: the record holds 1 January of that year.
    expect(third?.dateOfBirth.toISOString().slice(0, 10)).toBe('1988-01-01');
    expect((await entries({ patientProfileId: third?.id }))[0]?.replyStatus).toBe('FAILED');
  });
});
