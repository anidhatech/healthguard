/**
 * Patient registration at the front desk, and the rule that one ABHA number
 * links to one patient record in an organization (ABDM M1:
 * TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER). Every identity here is made up.
 */
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext, RequestMeta } from '../src/common/actor.js';
import { PatientRegistrationService } from '../src/modules/patients/patient-registration.service.js';
import { db, EMAIL, resetTo, signIn, startApp, type Session } from './harness.js';

const CLINIC = '019f0000-0000-7000-8000-0000000c11c0';
const DESK_USER = '019f0000-0000-7000-8000-0000000de5c0';
const DESK_MEMBER = '019f0000-0000-7000-8000-0000000de5c1';
const DESK_EMAIL = 'desk@city-care.test';
const PASSWORD = 'Registration-Test-2026';
const ABHA_NUMBER = '91-0000-0000-0001';

const META: RequestMeta = {
  requestId: 'registration-test',
  ipHash: null,
  userAgentHash: null,
  purposeHeader: null,
};

function deskActor(): ActorContext {
  return {
    userId: DESK_USER,
    sessionId: 'registration-test',
    displayName: 'Front Desk',
    email: DESK_EMAIL,
    preferredLocale: 'en-IN',
    authMethod: 'PASSWORD',
    roles: ['FRONT_DESK'],
    activeOrganizationId: CLINIC,
    memberId: DESK_MEMBER,
    memberRoles: ['FRONT_DESK'],
    clinicianId: null,
    patientProfileIds: [],
    isPlatformAdmin: false,
  };
}

const person = {
  givenName: 'Test',
  familyName: 'Person',
  dateOfBirth: '1980-01-01',
  sex: 'FEMALE',
} as const;

let app: INestApplication;
let desk: Session;
let registration: PatientRegistrationService;

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

/**
 * The demo seed refuses to run while a non-demo organization exists, so this
 * suite removes its clinic before it starts (a leftover from a crashed run) and
 * when it ends. Audit rows stay: that table is append-only.
 */
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
  app = await startApp();
  await resetTo(app, 0);
  await db.organization.create({
    data: {
      id: CLINIC,
      slug: 'city-care-clinic',
      name: 'City Care Clinic',
      type: 'CLINIC',
      isDemo: false,
    },
  });
  await db.user.create({
    data: {
      id: DESK_USER,
      email: DESK_EMAIL,
      displayName: 'Front Desk',
      passwordHash: await hash(PASSWORD),
    },
  });
  await db.organizationMember.create({
    data: {
      id: DESK_MEMBER,
      organizationId: CLINIC,
      userId: DESK_USER,
      roles: ['FRONT_DESK'],
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  desk = await passwordSignIn(DESK_EMAIL);
  registration = app.get(PatientRegistrationService);
});

afterAll(async () => {
  await removeClinic();
  await app.close();
});

describe('patient registration', () => {
  it('registers a real patient in a clinic organization', async () => {
    const response = await desk.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', desk.csrf)
      .send({ ...person, phone: '+910000000001', preferredLocale: 'te-IN' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      status: 'CREATED',
      patient: { mrn: 'CCC-000001', displayName: 'Test Person', abhaLinked: false },
    });
    const row = await db.patientProfile.findUniqueOrThrow({
      where: { id: response.body.data.patient.id as string },
    });
    expect(row).toMatchObject({
      organizationId: CLINIC,
      isSynthetic: false,
      preferredLocale: 'te-IN',
      abhaNumber: null,
    });
    const audit = await db.auditEvent.findFirst({
      where: { resourceType: 'PatientProfile', resourceId: row.id, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.metadata)).not.toContain('0000000001');
  });

  it('keeps the contact details given at the desk and shows them on the profile', async () => {
    const response = await desk.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', desk.csrf)
      .send({
        givenName: 'Contact',
        dateOfBirth: '1990-02-02',
        sex: 'OTHER',
        email: 'contact.person@example.test',
        addressLine: '12 Sample Road',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pinCode: '500001',
      })
      .expect(201);
    const id = response.body.data.patient.id as string;
    const row = await db.patientProfile.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({
      email: 'contact.person@example.test',
      addressLine: '12 Sample Road',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500001',
    });
    const profile = await desk.agent.get(`/api/v1/patients/${id}`).expect(200);
    expect(profile.body.data).toMatchObject({
      email: 'contact.person@example.test',
      address: '12 Sample Road, Hyderabad, Hyderabad, Telangana, 500001',
    });
    await db.patientProfile.delete({ where: { id } });

    const post = (body: object) =>
      desk.agent.post('/api/v1/patients').set('x-csrf-token', desk.csrf).send(body);
    await post({ ...person, email: 'not-an-email' }).expect(400);
    await post({ ...person, pinCode: '12' }).expect(400);
  });

  it('gives the next patient the next record number', async () => {
    const response = await desk.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', desk.csrf)
      .send({ givenName: 'Second', dateOfBirth: '1975-06-30', sex: 'MALE' })
      .expect(201);
    expect(response.body.data.patient.mrn).toBe('CCC-000002');
  });

  it('refuses invalid input and a date of birth in the future', async () => {
    const post = (body: object) =>
      desk.agent.post('/api/v1/patients').set('x-csrf-token', desk.csrf).send(body);
    await post({ ...person, givenName: ' ' }).expect(400);
    await post({ ...person, phone: 'not-a-phone' }).expect(400);
    await post({ ...person, abhaNumber: ABHA_NUMBER }).expect(400);
    await post({ ...person, dateOfBirth: '2999-01-01' }).expect(400);
  });

  it('refuses registration in a demo organization', async () => {
    const care = await signIn(app, EMAIL.care);
    const before = await db.patientProfile.count();
    await care.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', care.csrf)
      .send(person)
      .expect(403);
    expect(await db.patientProfile.count()).toBe(before);
  });

  it('is closed to doctors and to patients', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    await doctor.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', doctor.csrf)
      .send(person)
      .expect(403);
    const patient = await signIn(app, EMAIL.patient);
    await patient.agent
      .post('/api/v1/patients')
      .set('x-csrf-token', patient.csrf)
      .send(person)
      .expect(403);
  });
});

describe('one ABHA number, one patient record', () => {
  let firstId: string;

  it('links a verified ABHA number when it registers a new patient', async () => {
    const result = await registration.register(deskActor(), META, person, {
      abhaNumber: ABHA_NUMBER,
      abhaAddress: 'Test.Person@sbx',
    });
    expect(result.status).toBe('CREATED');
    expect(result.patient.abhaLinked).toBe(true);
    firstId = result.patient.id;
    const row = await db.patientProfile.findUniqueOrThrow({ where: { id: firstId } });
    expect(row.abhaNumber).toBe('91000000000001');
    expect(row.abhaAddress).toBe('test.person@sbx');
    expect(row.abhaVerifiedAt).not.toBeNull();
  });

  it('returns the existing patient instead of creating a second record', async () => {
    const before = await db.patientProfile.count({ where: { organizationId: CLINIC } });
    const again = await registration.register(
      deskActor(),
      META,
      { ...person, givenName: 'Different' },
      { abhaNumber: '91 0000 0000 0001' },
    );
    expect(again.status).toBe('EXISTING');
    expect(again.patient.id).toBe(firstId);
    expect(await db.patientProfile.count({ where: { organizationId: CLINIC } })).toBe(before);
  });

  it('refuses to link that ABHA number to another patient record', async () => {
    const other = await registration.register(deskActor(), META, { ...person, givenName: 'Other' });
    await expect(
      registration.linkAbha(deskActor(), META, other.patient.id, { abhaNumber: ABHA_NUMBER }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const linked = await registration.linkAbha(deskActor(), META, other.patient.id, {
      abhaNumber: '91-0000-0000-0002',
    });
    expect(linked.patient.abhaLinked).toBe(true);
    await expect(
      registration.linkAbha(deskActor(), META, other.patient.id, {
        abhaNumber: '91-0000-0000-0003',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('is enforced by the database as well', async () => {
    await expect(
      db.patientProfile.create({
        data: {
          organizationId: CLINIC,
          mrn: 'CCC-999999',
          givenName: 'Direct',
          dateOfBirth: new Date('1990-01-01T00:00:00Z'),
          sex: 'OTHER',
          dailyRoutine: {},
          abhaNumber: '91000000000001',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('never links an ABHA to a synthetic demo patient', async () => {
    const demoPatient = await db.patientProfile.findFirstOrThrow({ where: { isSynthetic: true } });
    const actor = { ...deskActor(), activeOrganizationId: demoPatient.organizationId };
    await expect(
      registration.linkAbha(actor, META, demoPatient.id, { abhaNumber: '91-0000-0000-0009' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
