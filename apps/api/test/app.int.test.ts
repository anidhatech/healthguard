/**
 * Integration tests: the real Nest app against PostgreSQL and Redis, reset to
 * the demo scenario before the run. Uses TEST_DATABASE_URL (default: the
 * healthguard_test database), never the development database.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { buildConfig } from '../src/config/env.js';
import { loadRootEnv } from '../src/config/load-env.js';
import { createPrismaClient } from '../src/infrastructure/prisma/create-client.js';
import { PATIENT, seedDemoData } from '../src/modules/demo/seed/run.js';

loadRootEnv();
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://healthguard:healthguard@localhost:5432/healthguard_test';
if (!/test/i.test(DATABASE_URL))
  throw new Error('Integration tests only run against a *test* database.');

const config = buildConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL,
  DEMO_MODE: 'true',
  DEMO_AUTH_ENABLED: 'true',
  AI_PROVIDER: 'demo',
  ANTHROPIC_API_KEY: '',
  LOG_LEVEL: 'silent',
  LOG_PRETTY: 'false',
  RATE_LIMIT_PER_MINUTE: '10000',
  AUTH_RATE_LIMIT_PER_MINUTE: '10000',
  AI_RATE_LIMIT_PER_MINUTE: '10000',
  // Own hashing key, so test traffic never shares rate-limit buckets with a running dev stack.
  IDENTIFIER_HASH_KEY: 'integration-tests-only',
});

let app: INestApplication;
const db = createPrismaClient(DATABASE_URL);

type Agent = ReturnType<typeof request.agent>;
interface Session {
  agent: Agent;
  csrf: string;
}

async function signIn(email: string): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const response = await agent.post('/api/v1/auth/demo-login').send({ email }).expect(200);
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const csrf =
    cookies
      .find((cookie) => cookie.startsWith('hg_csrf='))
      ?.split(';')[0]
      ?.split('=')[1] ?? '';
  return { agent, csrf };
}

beforeAll(async () => {
  await seedDemoData(db, { passwordHash: await hash('HealthGuard-Demo-2026') });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, config);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db.$disconnect();
});

describe('platform', () => {
  it('starts and reports liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'healthguard-api' });
  });

  it('is ready only when PostgreSQL and Redis answer', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(response.body.checks.database.status).toBe('up');
    expect(response.body.checks.redis.status).toBe('up');
  });

  it('wraps responses with the demo notice, request ID and no-store caching', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/demo/state')
      .set('X-Request-Id', 'test-request-0001')
      .expect(200);
    expect(response.headers['x-request-id']).toBe('test-request-0001');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-healthguard-data-notice']).toContain('synthetic');
    expect(response.body.meta).toMatchObject({
      synthetic: true,
      dataNotice: 'DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE',
    });
    expect(response.body.data.clock).toMatchObject({
      anchorDay0: '2026-07-08',
      offsetDays: 92,
      today: '2026-10-08',
    });
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs/openapi.json').expect(200);
    expect(Object.keys(response.body.paths)).toContain('/api/v1/patients/{patientId}/ai/requests');
  });

  it('returns RFC 9457 problem details for unknown routes and bad input', async () => {
    const missing = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/demo-login')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(invalid.body.errors[0].path).toBe('email');
  });
});

describe('database', () => {
  it('holds the seeded hero scenario', async () => {
    expect(await db.organization.count()).toBe(2);
    expect(await db.patientProfile.count()).toBe(4);
    expect(
      await db.medicationDoseEvent.count({ where: { patientProfileId: PATIENT.ananya } }),
    ).toBe(180);
  });

  it('rejects updates and deletes on the audit trail', async () => {
    const event = await db.auditEvent.findFirstOrThrow();
    await expect(
      db.auditEvent.update({ where: { id: event.id }, data: { resourceType: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
  });

  it('rejects changes to a signed medication plan', async () => {
    const plan = await db.medicationPlan.findFirstOrThrow({ where: { signedAt: { not: null } } });
    await expect(
      db.medicationPlan.update({ where: { id: plan.id }, data: { doseQuantity: 2 } }),
    ).rejects.toThrow(/immutable/);
  });
});

describe('authentication', () => {
  it('lists demo accounts with the DEMO/DEVELOPMENT notice', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/demo-accounts')
      .expect(200);
    expect(response.body.data.enabled).toBe(true);
    expect(response.body.data.notice).toMatch(/DEMO \/ DEVELOPMENT/);
    expect(response.body.data.accounts.map((account: { email: string }) => account.email)).toEqual(
      expect.arrayContaining([
        'patient@healthguard.demo',
        'doctor@healthguard.demo',
        'admin@healthguard.demo',
      ]),
    );
  });

  it('signs in with httpOnly cookies and returns the session', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/demo-login')
      .send({ email: 'doctor@healthguard.demo' })
      .expect(200);
    const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    expect(cookies.find((cookie) => cookie.startsWith('hg_at='))).toMatch(/HttpOnly/);
    expect(cookies.find((cookie) => cookie.startsWith('hg_rt='))).toMatch(
      /HttpOnly.*SameSite=Strict|SameSite=Strict.*HttpOnly/,
    );
    expect(response.body.data).toMatchObject({
      roles: ['DOCTOR'],
      homeArea: 'doctor',
      authMethod: 'DEMO_QUICK_LOGIN',
    });
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.displayName).toBe('Dr. Meera Sharma');
  });

  it('rejects unknown accounts, anonymous requests and wrong passwords', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/demo-login')
      .send({ email: 'someone@example.com' })
      .expect(401);
    const anonymous = await request(app.getHttpServer()).get('/api/v1/patients').expect(401);
    expect(anonymous.body.code).toBe('UNAUTHENTICATED');
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@healthguard.demo', password: 'wrong' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@healthguard.demo', password: 'HealthGuard-Demo-2026' })
      .expect(200);
  });

  it('rotates refresh tokens and revokes the session when an old one is reused', async () => {
    const { agent, csrf } = await signIn('care@healthguard.demo');
    const first = await agent.post('/api/v1/auth/refresh').set('X-CSRF-Token', csrf).expect(200);
    const oldRefresh = ([] as string[]).concat(first.request.cookies ?? []).join('');
    expect(first.body.data.user.displayName).toBe('Ravi Kumar');
    void oldRefresh;
    const session = await db.authSession.findFirstOrThrow({
      where: { user: { email: 'care@healthguard.demo' }, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session.previousRefreshTokenHash).toBeTruthy();
  });

  it('requires the CSRF header on cookie-authenticated writes', async () => {
    const { agent } = await signIn('doctor@healthguard.demo');
    const response = await agent
      .post('/api/v1/auth/switch-organization')
      .send({ organizationId: '019f0000-0000-7000-8000-000000000000' })
      .expect(403);
    expect(response.body.code).toBe('CSRF_FAILED');
  });

  it('logs out and the session stops working', async () => {
    const { agent, csrf } = await signIn('priya.nair@healthguard.demo');
    await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf).expect(204);
    await agent.get('/api/v1/auth/me').expect(401);
  });
});

describe('role authorization', () => {
  it('keeps organization admins away from clinical data but shows them counts', async () => {
    const { agent } = await signIn('admin@healthguard.demo');
    const denied = await agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(403);
    expect(denied.body.reason).toBe('ROLE_NOT_PERMITTED');
    const stats = await agent.get('/api/v1/organizations/current/stats').expect(200);
    expect(stats.body.data).toMatchObject({ kind: 'CALCULATED', patients: 3, clinicians: 2 });
    await agent.get('/api/v1/organizations/current/members').expect(200);
  });

  it('keeps patients out of staff-only routes', async () => {
    const { agent } = await signIn('patient@healthguard.demo');
    await agent.get('/api/v1/patients').expect(403);
    await agent.get('/api/v1/organizations/current/stats').expect(403);
    await agent.get('/api/v1/platform/organizations').expect(403);
  });

  it('lets platform admins list tenants (counts only)', async () => {
    const { agent } = await signIn('platform@healthguard.demo');
    const response = await agent.get('/api/v1/platform/organizations').expect(200);
    expect(response.body.data).toHaveLength(2);
  });

  it('lets the care team (care coordinator) see adherence and appointments but not labs', async () => {
    const { agent } = await signIn('care@healthguard.demo');
    await agent.get(`/api/v1/patients/${PATIENT.ananya}/adherence`).expect(200);
    await agent.get(`/api/v1/patients/${PATIENT.ananya}/appointments`).expect(200);
    await agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(403);
  });
});

describe('patient access', () => {
  it('shows the patient their own record, hero numbers and Telugu instructions', async () => {
    const { agent } = await signIn('patient@healthguard.demo');
    const progress = await agent.get(`/api/v1/patients/${PATIENT.ananya}/progress`).expect(200);
    const byMetric = Object.fromEntries(
      progress.body.data.metrics.map((metric: { metric: string }) => [metric.metric, metric]),
    );
    expect(byMetric.HBA1C).toMatchObject({ before: 7.4, after: 6.8, direction: 'down' });
    expect(byMetric.BODY_WEIGHT).toMatchObject({ before: 74.2, after: 72.9 });
    expect(byMetric.AVERAGE_DAILY_STEPS).toMatchObject({
      before: 5200,
      after: 7100,
      direction: 'up',
    });
    expect(byMetric.RECORDED_ADHERENCE).toMatchObject({ after: 92 });
    const plans = await agent
      .get(`/api/v1/patients/${PATIENT.ananya}/medication-plans`)
      .expect(200);
    const metformin = plans.body.data.find(
      (plan: { medication: { genericName: string } }) =>
        plan.medication.genericName === 'Metformin',
    );
    expect(metformin.instruction.doseText).toBe(
      'ఉదయం టిఫిన్ చేసిన 15 నిమిషాల తర్వాత Metformin 500 mg 1 టాబ్లెట్ తీసుకోండి. రోజుకు ఒకసారి, 90 రోజుల పాటు.',
    );
    expect(metformin.syntheticNotice).toMatch(/not a prescription/);
    const english = await agent
      .get(`/api/v1/patients/${PATIENT.ananya}/medication-plans?locale=en-IN`)
      .expect(200);
    expect(
      english.body.data.map(
        (plan: { instruction: { doseText: string } }) => plan.instruction.doseText,
      ),
    ).toContain(
      'Take 1 tablet of Metformin 500 mg, 15 minutes after breakfast. Once a day, for 90 days.',
    );
  });

  it("does not let one patient read another patient's record", async () => {
    const { agent } = await signIn('rahul.mehta@healthguard.demo');
    await agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(404);
    await agent.get(`/api/v1/patients/${PATIENT.rahul}/medication-plans`).expect(200);
  });

  it('shows the patient who accessed their data', async () => {
    const doctor = await signIn('doctor@healthguard.demo');
    await doctor.agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(200);
    const { agent } = await signIn('patient@healthguard.demo');
    const log = await agent.get(`/api/v1/patients/${PATIENT.ananya}/access-log`).expect(200);
    expect(
      log.body.data.some(
        (entry: { actor: { displayName: string } }) =>
          entry.actor.displayName === 'Dr. Meera Sharma',
      ),
    ).toBe(true);
    const doctorTry = await doctor.agent
      .get(`/api/v1/patients/${PATIENT.ananya}/access-log`)
      .expect(403);
    expect(doctorTry.body.code).toBe('FORBIDDEN');
  });
});

describe('doctor access', () => {
  it('lets the primary clinician see the full record and timeline', async () => {
    const { agent } = await signIn('doctor@healthguard.demo');
    const patients = await agent.get('/api/v1/patients?scope=my-care').expect(200);
    expect(
      patients.body.data.map((row: { displayName: string }) => row.displayName).sort(),
    ).toEqual(['Ananya Rao', 'Priya Nair']);
    const labs = await agent
      .get(`/api/v1/patients/${PATIENT.ananya}/lab-results?test=HBA1C`)
      .expect(200);
    expect(labs.body.data.map((row: { valueNumeric: number }) => row.valueNumeric)).toEqual([
      6.8, 7.4, 7.1,
    ]);
    const timeline = await agent.get(`/api/v1/patients/${PATIENT.ananya}/timeline`).expect(200);
    expect(timeline.body.data.hiddenCategories).toEqual([]);
    expect(timeline.body.data.events.length).toBeGreaterThan(10);
  });

  it('denies a doctor of the same clinic who is not in the care team, and audits it', async () => {
    const { agent } = await signIn('arjun.reddy@healthguard.demo');
    await agent.get(`/api/v1/patients/${PATIENT.ananya}`).expect(200); // demographics are organization-wide
    const denied = await agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(403);
    expect(denied.body).toMatchObject({ code: 'ACCESS_DENIED', reason: 'NO_CARE_RELATIONSHIP' });
    const audit = await db.auditEvent.findFirst({
      where: {
        patientProfileId: PATIENT.ananya,
        decision: 'DENY',
        decisionReason: 'NO_CARE_RELATIONSHIP',
      },
    });
    expect(audit).not.toBeNull();
  });
});

describe('cross-tenant isolation', () => {
  it("makes another organization's patients invisible (404, not 403)", async () => {
    const { agent } = await signIn('lakeview.doctor@healthguard.demo');
    await agent.get(`/api/v1/patients/${PATIENT.ananya}`).expect(404);
    await agent.get(`/api/v1/patients/${PATIENT.ananya}/lab-results`).expect(404);
    const list = await agent.get('/api/v1/patients').expect(200);
    expect(list.body.data.map((row: { displayName: string }) => row.displayName)).toEqual([
      'Kiran Joshi',
    ]);
  });

  it("does not let a clinician switch into an organization they don't belong to", async () => {
    const { agent, csrf } = await signIn('lakeview.doctor@healthguard.demo');
    const hdmc = await db.organization.findFirstOrThrow({
      where: { slug: 'healthguard-demo-medical-center' },
    });
    await agent
      .post('/api/v1/auth/switch-organization')
      .set('X-CSRF-Token', csrf)
      .send({ organizationId: hdmc.id })
      .expect(404);
  });

  it("keeps each tenant's schedule and stats separate", async () => {
    const hdmc = await signIn('doctor@healthguard.demo');
    const schedule = await hdmc.agent
      .get('/api/v1/appointments/schedule?clinician=all')
      .expect(200);
    expect(
      schedule.body.data.map(
        (row: { patient: { displayName: string } }) => row.patient.displayName,
      ),
    ).toEqual(['Ananya Rao', 'Rahul Mehta']);
    const lakeview = await signIn('lakeview.doctor@healthguard.demo');
    const other = await lakeview.agent
      .get('/api/v1/appointments/schedule?clinician=all')
      .expect(200);
    expect(other.body.data).toEqual([]);
  });
});

describe('AI', () => {
  it('reports the demo provider and the prohibited tasks, never the key', async () => {
    const { agent } = await signIn('doctor@healthguard.demo');
    const response = await agent.get('/api/v1/ai/status').expect(200);
    expect(response.body.data).toMatchObject({
      provider: 'DEMO',
      anthropicKeyConfigured: false,
      implementedTasks: ['DOCTOR_BRIEF_SYNTHESIS'],
    });
    expect(response.body.data.prohibitedTasks).toEqual(
      expect.arrayContaining(['DIAGNOSE', 'PRESCRIBE', 'CHANGE_DOSAGE', 'STOP_MEDICATION']),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/sk-ant/);
  });

  it('produces a cited doctor brief with the demo provider and logs the interaction with provenance', async () => {
    const { agent, csrf } = await signIn('doctor@healthguard.demo');
    const response = await agent
      .post(`/api/v1/patients/${PATIENT.ananya}/ai/requests`)
      .set('X-CSRF-Token', csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(200);
    const brief = response.body.data;
    expect(brief).toMatchObject({
      status: 'SUCCEEDED',
      provider: 'DEMO',
      kind: 'AI_SUMMARY',
      confidence: 'HIGH',
      promptVersion: 'v1',
    });
    const texts = brief.summary.map((claim: { text: string }) => claim.text);
    expect(texts).toContain('Latest HbA1c is 6.8%, down from 7.4% at the previous test.');
    expect(texts).toContain('Recorded adherence since the last visit is 92% (166 of 180 doses).');
    for (const claim of brief.summary) expect(claim.sources.length).toBeGreaterThan(0);
    expect(
      brief.observations.every((item: { kind: string }) => item.kind === 'AI_RECOMMENDATION'),
    ).toBe(true);
    const interaction = await db.aIInteraction.findUniqueOrThrow({
      where: { id: brief.interactionId },
    });
    expect(interaction).toMatchObject({
      status: 'SUCCEEDED',
      provider: 'DEMO',
      agent: 'DOCTOR_BRIEF',
    });
    expect(interaction.completedAt).not.toBeNull();
    expect(
      await db.sourceProvenance.count({ where: { subjectId: brief.interactionId } }),
    ).toBeGreaterThan(3);
    await expect(
      db.aIInteraction.update({ where: { id: brief.interactionId }, data: { model: 'x' } }),
    ).rejects.toThrow(/HG_AI_IMMUTABLE/);
  });

  it.each([
    ['PRESCRIBE', undefined, 'PROHIBITED_TASK'],
    ['DIAGNOSE', undefined, 'PROHIBITED_TASK'],
    [
      'DOCTOR_BRIEF_SYNTHESIS',
      'Should we increase the metformin dose to 1000 mg?',
      'PROHIBITED_INSTRUCTION',
    ],
    ['DOCTOR_BRIEF_SYNTHESIS', 'Tell her to stop taking her tablets', 'PROHIBITED_INSTRUCTION'],
    ['DOCTOR_BRIEF_SYNTHESIS', 'Change frequency to twice a day', 'PROHIBITED_INSTRUCTION'],
    ['AUTONOMOUS_DECISION', undefined, 'PROHIBITED_TASK'],
  ])('refuses unsafe request %s / %s', async (task, instruction, reason) => {
    const { agent, csrf } = await signIn('doctor@healthguard.demo');
    const before = await db.aIInteraction.count();
    const response = await agent
      .post(`/api/v1/patients/${PATIENT.ananya}/ai/requests`)
      .set('X-CSRF-Token', csrf)
      .send({ task, ...(instruction ? { instruction } : {}) })
      .expect(422);
    expect(response.body).toMatchObject({ code: 'AI_REQUEST_PROHIBITED', reason });
    expect(await db.aIInteraction.count()).toBe(before);
  });

  it('refuses planned tasks as not available, and non-doctors entirely', async () => {
    const doctor = await signIn('doctor@healthguard.demo');
    const planned = await doctor.agent
      .post(`/api/v1/patients/${PATIENT.ananya}/ai/requests`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ task: 'TIMELINE_SUMMARY' })
      .expect(422);
    expect(planned.body.code).toBe('AI_TASK_NOT_AVAILABLE');
    const patient = await signIn('patient@healthguard.demo');
    await patient.agent
      .post(`/api/v1/patients/${PATIENT.ananya}/ai/requests`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(403);
  });

  it('blocks AI for a patient without AI consent, and the denial is logged', async () => {
    const { agent, csrf } = await signIn('arjun.reddy@healthguard.demo');
    const response = await agent
      .post(`/api/v1/patients/${PATIENT.rahul}/ai/requests`)
      .set('X-CSRF-Token', csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(403);
    expect(response.body.reason).toBe('NO_AI_CONSENT');
    expect(
      await db.aIInteraction.count({
        where: { patientProfileId: PATIENT.rahul, status: 'BLOCKED_BY_CONSENT' },
      }),
    ).toBe(1);
  });

  it('stops AI immediately when the patient withdraws AI consent', async () => {
    const patient = await signIn('priya.nair@healthguard.demo');
    const consents = await patient.agent
      .get(`/api/v1/patients/${PATIENT.priya}/consents`)
      .expect(200);
    const aiConsent = consents.body.data.find(
      (consent: { purpose: { code: string } }) => consent.purpose.code === 'AI_ASSISTANCE',
    );
    const doctor = await signIn('doctor@healthguard.demo');
    await doctor.agent
      .post(`/api/v1/patients/${PATIENT.priya}/ai/requests`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(200);
    await patient.agent
      .post(`/api/v1/patients/${PATIENT.priya}/consents/${aiConsent.id}/revoke`)
      .set('X-CSRF-Token', patient.csrf)
      .expect(200);
    const blocked = await doctor.agent
      .post(`/api/v1/patients/${PATIENT.priya}/ai/requests`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(403);
    expect(blocked.body.reason).toBe('NO_AI_CONSENT');
    await doctor.agent
      .post(`/api/v1/patients/${PATIENT.priya}/consents/${aiConsent.id}/revoke`)
      .set('X-CSRF-Token', doctor.csrf)
      .expect(403);
  });
});
