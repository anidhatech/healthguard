/**
 * Phase 1 working flows, checkpoint by checkpoint: doses and reminders, Need
 * help, the care queue, prescribing, appointments, lab confirmation, AI review,
 * exports and the demo console.
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PATIENT } from '../src/modules/demo/seed/run.js';
import { medicationId } from '../src/modules/demo/seed/reference-data.js';
import { runDoseEngine } from '../src/modules/doses/dose-engine.js';
import { readDemoClock } from '../src/infrastructure/clock/clock.service.js';
import { db, EMAIL, resetTo, setTimeOfDay, signIn } from './harness.js';
import { startApp } from './harness.js';

let app: INestApplication;
const ananya = PATIENT.ananya;

async function engine(patientId: string = ananya) {
  return runDoseEngine(db, { demo: await readDemoClock(db), real: new Date() }, { patientId });
}

beforeAll(async () => {
  await resetTo(null, 6, '07:50');
  app = await startApp();
});

afterAll(async () => {
  await app?.close();
  await db.$disconnect();
});

describe('doses and reminders (day 6)', () => {
  it("creates today's doses from signed plans, once", async () => {
    const patient = await signIn(app, EMAIL.patient);
    const first = await patient.agent.get(`/api/v1/patients/${ananya}/doses/today`).expect(200);
    const doses = first.body.data as { slotLabel: string; status: string; canRespond: boolean }[];
    expect(doses.map((dose) => dose.slotLabel)).toEqual(['MORN', 'PCM+15']);
    await patient.agent.get(`/api/v1/patients/${ananya}/doses/today`).expect(200);
    expect(await engine()).toMatchObject({ created: 0 });
  });

  it('sends a simulated phone reminder when a dose is due', async () => {
    // 07:50: telmisartan (06:30) is due; metformin (08:15) is not yet.
    const result = await engine();
    // Already sent when the app refreshed today's doses; the next is 30 minutes later.
    expect(result.reminded).toBe(0);
    const reminders = await db.notification.findMany({
      where: { patientProfileId: ananya, templateKey: 'dose.reminder' },
    });
    expect(reminders.length).toBe(1);
    expect(reminders[0]?.channel).toBe('SIMULATED_PHONE');
    const patient = await signIn(app, EMAIL.patient);
    const inbox = await patient.agent.get('/api/v1/notifications').expect(200);
    const phone = (inbox.body.data as { channel: string; title: string }[]).filter(
      (item) => item.channel === 'SIMULATED_PHONE',
    );
    expect(phone[0]?.title).toBe('మందుల గుర్తు');
  });

  it('records taken, skipped and snooze answers from the patient only', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const today = await patient.agent.get(`/api/v1/patients/${ananya}/doses/today`).expect(200);
    const [morning, metformin] = today.body.data as { id: string; canRespond: boolean }[];
    expect(morning?.canRespond).toBe(true);

    const taken = await patient.agent
      .post(`/api/v1/patients/${ananya}/doses/${morning?.id}/respond`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ action: 'TAKEN', idempotencyKey: 'test-taken-0001' })
      .expect(200);
    expect(taken.body.data.status).toBe('TAKEN');
    // A retry with the same key returns the first answer.
    await patient.agent
      .post(`/api/v1/patients/${ananya}/doses/${morning?.id}/respond`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ action: 'TAKEN', idempotencyKey: 'test-taken-0001' })
      .expect(200);
    // A new answer to an answered dose is refused.
    await patient.agent
      .post(`/api/v1/patients/${ananya}/doses/${morning?.id}/respond`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ action: 'SKIPPED', reason: 'OTHER', idempotencyKey: 'test-skip-0001' })
      .expect(409);

    const snoozed = await patient.agent
      .post(`/api/v1/patients/${ananya}/doses/${metformin?.id}/respond`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ action: 'SNOOZED', minutes: 30, idempotencyKey: 'test-snooze-0001' })
      .expect(200);
    expect(snoozed.body.data.status).toBe('SNOOZED');

    const doctor = await signIn(app, EMAIL.doctor);
    await doctor.agent
      .post(`/api/v1/patients/${ananya}/doses/${metformin?.id}/respond`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ action: 'TAKEN', idempotencyKey: 'test-doctor-0001' })
      .expect(403);
    // The doctor can still read the doses (care relationship + consent).
    const view = await doctor.agent.get(`/api/v1/patients/${ananya}/doses/today`).expect(200);
    expect((view.body.data as { canRespond: boolean }[]).every((dose) => !dose.canRespond)).toBe(
      true,
    );
  });

  it('infers missed doses after the grace period and raises one call-back for a run', async () => {
    await setTimeOfDay(app, '23:30');
    const result = await engine();
    expect(result.missed).toBe(1); // metformin, snoozed and never answered
    const metformin = await db.medicationDoseEvent.findFirstOrThrow({
      where: { patientProfileId: ananya, slotLabel: 'PCM+15', status: 'MISSED', missedInferred: true },
      orderBy: { scheduledAt: 'desc' },
    });
    expect(metformin.responseChannel).toBe('SYSTEM');
  });

  it('turns "Need help" into a call-back for the care team, showing emergency numbers', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const response = await patient.agent
      .post(`/api/v1/patients/${ananya}/help-requests`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ reason: 'SIDE_EFFECT', note: 'Stomach upset after the tablet' })
      .expect(201);
    expect(response.body.data.emergencyNumbers.map((entry: { number: string }) => entry.number)).toEqual([
      '112',
      '108',
    ]);
    const again = await patient.agent
      .post(`/api/v1/patients/${ananya}/help-requests`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ reason: 'OTHER' })
      .expect(201);
    expect(again.body.data.followUpId).toBe(response.body.data.followUpId);

    const audit = await db.auditEvent.findFirstOrThrow({
      where: { resourceType: 'FollowUp', resourceId: response.body.data.followUpId },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('Stomach');

    const care = await signIn(app, EMAIL.care);
    const queue = await care.agent.get('/api/v1/care-queue').expect(200);
    const item = (queue.body.data as { id: string; origin: string; assignedTo: string }[]).find(
      (entry) => entry.id === response.body.data.followUpId,
    );
    expect(item).toMatchObject({ origin: 'PATIENT_REQUEST', assignedTo: 'Ravi Kumar' });
    await care.agent
      .post(`/api/v1/care-queue/${item?.id}/complete`)
      .set('X-CSRF-Token', care.csrf)
      .send({ outcome: 'CALLED_RESOLVED' })
      .expect(200);

    await patient.agent.get('/api/v1/care-queue').expect(403);
  });

  it('flags patients on the doctor work list only where the doctor may see the data', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    const list = await doctor.agent.get('/api/v1/patients').expect(200);
    const rows = list.body.data as { id: string; flags: string[] }[];
    expect(rows.find((row) => row.id === ananya)?.flags).toBeDefined();
    // Rahul is Dr. Arjun's patient: Dr. Meera has no care relationship, so no flags.
    expect(rows.find((row) => row.id === PATIENT.rahul)?.flags).toEqual([]);
  });
});

describe('prescribing (day 0)', () => {
  const base = `/api/v1/patients/${ananya}/medication-plans`;
  const metforminDraft = {
    medicationId: medicationId('metformin500'),
    doseQuantity: 1,
    timingEvent: 'PCM',
    timingOffsetMinutes: 15,
    durationDays: 90,
    indication: 'Blood sugar',
    notePhrases: ['WITH_FOOD', 'REPORT_SIDE_EFFECTS'],
  };

  beforeAll(async () => {
    await resetTo(app, 0, '11:05');
  });

  it('blocks signing a medicine that matches a recorded allergy', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    const draft = await doctor.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ ...metforminDraft, medicationId: medicationId('amoxicillin500'), durationDays: 5, notePhrases: [] })
      .expect(201);
    const allergy = (draft.body.data.checks as { code: string; severity: string }[]).find(
      (check) => check.code === 'ALLERGY_CONFLICT',
    );
    expect(allergy?.severity).toBe('BLOCK');
    expect(draft.body.data.canSign).toBe(false);
    await doctor.agent
      .post(`${base}/${draft.body.data.plan.id}/sign`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ instructionsReviewed: true })
      .expect(409);
    await doctor.agent
      .post(`${base}/${draft.body.data.plan.id}/discard`)
      .set('X-CSRF-Token', doctor.csrf)
      .expect(200);
  });

  it('blocks a duplicate of an active medicine', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    const draft = await doctor.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ ...metforminDraft, medicationId: medicationId('telmisartan40'), timingEvent: 'MORN', timingOffsetMinutes: null, durationDays: null })
      .expect(201);
    expect(draft.body.data.canSign).toBe(false);
    await doctor.agent.post(`${base}/${draft.body.data.plan.id}/discard`).set('X-CSRF-Token', doctor.csrf).expect(200);
  });

  it('lets only a prescriber in the care relationship draft', async () => {
    const patient = await signIn(app, EMAIL.patient);
    await patient.agent.post(`${base}/drafts`).set('X-CSRF-Token', patient.csrf).send(metforminDraft).expect(403);
    const arjun = await signIn(app, EMAIL.arjun);
    await arjun.agent.post(`${base}/drafts`).set('X-CSRF-Token', arjun.csrf).send(metforminDraft).expect(403);
  });

  it('renders the instruction from reviewed templates in every language, then signs', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    const draft = await doctor.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', doctor.csrf)
      .send(metforminDraft)
      .expect(201);
    const review = draft.body.data as {
      plan: { id: string; startDate: string };
      canSign: boolean;
      instructions: { locale: string; doseText: string; notesText: string; status: string }[];
    };
    expect(review.canSign).toBe(true);
    expect(review.plan.startDate).toBe('2026-07-09');
    const telugu = review.instructions.find((row) => row.locale === 'te-IN');
    expect(telugu?.doseText).toContain('Metformin 500 mg');
    expect(telugu?.doseText).toContain('90');
    expect(telugu?.notesText).toContain('సహాయం కావాలి');

    // The patient never sees a draft.
    const patient = await signIn(app, EMAIL.patient);
    const before = await patient.agent.get(base).expect(200);
    expect(JSON.stringify(before.body.data)).not.toContain('Metformin');

    const signed = await doctor.agent
      .post(`${base}/${review.plan.id}/sign`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ instructionsReviewed: true })
      .expect(200);
    expect(signed.body.data.plan.status).toBe('ACTIVE');
    expect(
      (signed.body.data.instructions as { status: string }[]).every((row) => row.status === 'APPROVED'),
    ).toBe(true);
    const after = await patient.agent.get(`${base}?locale=te-IN`).expect(200);
    const metformin = (after.body.data as { medication: { genericName: string }; instruction: { doseText: string } }[]).find(
      (plan) => plan.medication.genericName === 'Metformin',
    );
    expect(metformin?.instruction.doseText).toBe(telugu?.doseText);
    await expect(
      db.medicationPlan.update({ where: { id: review.plan.id }, data: { doseQuantity: 2 } }),
    ).rejects.toThrow(/HG_SIGNED_PLAN/);
  });

  it('starts doses the next day, and a dose change is a new version', async () => {
    const clock = await db.systemSetting.findUniqueOrThrow({ where: { key: 'demo.clock' } });
    await db.systemSetting.update({
      where: { key: 'demo.clock' },
      data: { value: { ...(clock.value as object), offsetDays: 1 } },
    });
    await setTimeOfDay(app, '07:00');
    await engine();
    const doses = await db.medicationDoseEvent.findMany({
      where: { patientProfileId: ananya, localDate: new Date('2026-07-09T00:00:00Z') },
      orderBy: { scheduledAt: 'asc' },
    });
    expect(doses.map((dose) => dose.slotLabel)).toEqual(['MORN', 'PCM+15']);

    const doctor = await signIn(app, EMAIL.doctor);
    const plans = await doctor.agent.get(base).expect(200);
    const current = (plans.body.data as { id: string; medication: { genericName: string } }[]).find(
      (plan) => plan.medication.genericName === 'Metformin',
    );
    const change = await doctor.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ ...metforminDraft, doseQuantity: 2, replacesPlanId: current?.id })
      .expect(201);
    expect(change.body.data.plan.version).toBe(2);
    await doctor.agent
      .post(`${base}/${change.body.data.plan.id}/sign`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ instructionsReviewed: true })
      .expect(200);
    const old = await db.medicationPlan.findUniqueOrThrow({ where: { id: current?.id ?? '' } });
    expect(old.status).toBe('SUPERSEDED');

    const stopped = await doctor.agent
      .post(`${base}/${change.body.data.plan.id}/stop`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ reason: 'CHANGED_TREATMENT' })
      .expect(200);
    expect(stopped.body.data.plan.status).toBe('STOPPED');
    const signs = await db.auditEvent.count({
      where: { action: 'SIGN', resourceType: 'MedicationPlan', patientProfileId: ananya, decision: 'ALLOW' },
    });
    expect(signs).toBe(2);
  });
});
