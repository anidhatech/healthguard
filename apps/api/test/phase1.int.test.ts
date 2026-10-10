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
      where: {
        patientProfileId: ananya,
        slotLabel: 'PCM+15',
        status: 'MISSED',
        missedInferred: true,
      },
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
    expect(
      response.body.data.emergencyNumbers.map((entry: { number: string }) => entry.number),
    ).toEqual(['112', '108']);
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
      .send({
        ...metforminDraft,
        medicationId: medicationId('amoxicillin500'),
        durationDays: 5,
        notePhrases: [],
      })
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
      .send({
        ...metforminDraft,
        medicationId: medicationId('telmisartan40'),
        timingEvent: 'MORN',
        timingOffsetMinutes: null,
        durationDays: null,
      })
      .expect(201);
    expect(draft.body.data.canSign).toBe(false);
    await doctor.agent
      .post(`${base}/${draft.body.data.plan.id}/discard`)
      .set('X-CSRF-Token', doctor.csrf)
      .expect(200);
  });

  it('lets only a prescriber in the care relationship draft', async () => {
    const patient = await signIn(app, EMAIL.patient);
    await patient.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', patient.csrf)
      .send(metforminDraft)
      .expect(403);
    const arjun = await signIn(app, EMAIL.arjun);
    await arjun.agent
      .post(`${base}/drafts`)
      .set('X-CSRF-Token', arjun.csrf)
      .send(metforminDraft)
      .expect(403);
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
      (signed.body.data.instructions as { status: string }[]).every(
        (row) => row.status === 'APPROVED',
      ),
    ).toBe(true);
    const after = await patient.agent.get(`${base}?locale=te-IN`).expect(200);
    const metformin = (
      after.body.data as {
        medication: { genericName: string };
        instruction: { doseText: string };
      }[]
    ).find((plan) => plan.medication.genericName === 'Metformin');
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
      where: {
        action: 'SIGN',
        resourceType: 'MedicationPlan',
        patientProfileId: ananya,
        decision: 'ALLOW',
      },
    });
    expect(signs).toBe(2);
  });
});

describe('lab report confirmation (day 85)', () => {
  beforeAll(async () => {
    await resetTo(app, 85, '10:00');
  });

  it('shows values read from a report but leaves them out of trends until confirmed', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const labs = await patient.agent
      .get(`/api/v1/patients/${ananya}/lab-results?test=HBA1C`)
      .expect(200);
    const latest = (
      labs.body.data as {
        id: string;
        awaitingConfirmation: boolean;
        documentId: string;
        valueNumeric: number;
      }[]
    )[0];
    expect(latest?.awaitingConfirmation).toBe(true);
    expect(latest?.valueNumeric).toBe(6.8);
    const progress = await patient.agent.get(`/api/v1/patients/${ananya}/progress`).expect(200);
    const hba1c = (progress.body.data.metrics as { metric: string; after: number }[]).find(
      (m) => m.metric === 'HBA1C',
    );
    expect(hba1c?.after).toBe(7.4);

    const doctor = await signIn(app, EMAIL.doctor);
    const list = await doctor.agent.get('/api/v1/patients').expect(200);
    expect(
      (list.body.data as { id: string; flags: string[] }[]).find((row) => row.id === ananya)?.flags,
    ).toContain('LAB_TO_CONFIRM');

    const pending = await db.labResult.findMany({
      where: { documentId: latest?.documentId, verification: 'UNVERIFIED' },
    });
    await doctor.agent
      .post(`/api/v1/patients/${ananya}/documents/${latest?.documentId}/confirm-values`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({
        results: pending.map((row) => ({ labResultId: row.id, decision: 'MATCHES_REPORT' })),
      })
      .expect(403);
    const confirmed = await patient.agent
      .post(`/api/v1/patients/${ananya}/documents/${latest?.documentId}/confirm-values`)
      .set('X-CSRF-Token', patient.csrf)
      .send({
        results: pending.map((row) => ({ labResultId: row.id, decision: 'MATCHES_REPORT' })),
      })
      .expect(200);
    expect(confirmed.body.data).toMatchObject({
      confirmed: pending.length,
      documentStatus: 'VERIFIED',
    });

    const after = await patient.agent.get(`/api/v1/patients/${ananya}/progress`).expect(200);
    const updated = (after.body.data.metrics as { metric: string; after: number }[]).find(
      (m) => m.metric === 'HBA1C',
    );
    expect(updated?.after).toBe(6.8);
    expect(after.body.data.association).toContain('does not show that one caused the other');
  });
});

describe('appointments (day 88)', () => {
  beforeAll(async () => {
    await resetTo(app, 88, '18:00');
  });

  it('is confirmed only after the patient approves', async () => {
    const proposed = await db.appointment.findFirstOrThrow({
      where: { patientProfileId: ananya, status: 'PROPOSED' },
    });
    const base = `/api/v1/patients/${ananya}/appointments/${proposed.id}`;
    const care = await signIn(app, EMAIL.care);
    const early = await care.agent
      .post(`${base}/confirm`)
      .set('X-CSRF-Token', care.csrf)
      .expect(409);
    expect(early.body.detail).toContain('not approved');

    const patient = await signIn(app, EMAIL.patient);
    await patient.agent.post(`${base}/approve`).set('X-CSRF-Token', patient.csrf).expect(200);
    const confirmed = await care.agent
      .post(`${base}/confirm`)
      .set('X-CSRF-Token', care.csrf)
      .expect(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    const followUp = await db.followUp.findUniqueOrThrow({
      where: { id: proposed.followUpId ?? '' },
    });
    expect(followUp.status).toBe('SCHEDULED');
    const inbox = await patient.agent.get('/api/v1/notifications').expect(200);
    expect(JSON.stringify(inbox.body.data)).toContain('ఖరారైంది');
  });

  it('lets staff propose, the patient decline, and the patient ask for a visit', async () => {
    const care = await signIn(app, EMAIL.care);
    const meera = await db.clinicianProfile.findFirstOrThrow({
      where: { displayName: { contains: 'Meera' } },
    });
    const proposed = await care.agent
      .post(`/api/v1/patients/${ananya}/appointments`)
      .set('X-CSRF-Token', care.csrf)
      .send({ clinicianId: meera.id, startAt: '2026-10-20T05:30:00.000Z', reason: 'Extra review' })
      .expect(201);
    await care.agent
      .post(`/api/v1/patients/${ananya}/appointments`)
      .set('X-CSRF-Token', care.csrf)
      .send({ clinicianId: meera.id, startAt: '2026-10-20T05:40:00.000Z', reason: 'Clash' })
      .expect(409);
    const patient = await signIn(app, EMAIL.patient);
    const declined = await patient.agent
      .post(`/api/v1/patients/${ananya}/appointments/${proposed.body.data.id}/cancel`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ reason: 'PATIENT_DECLINED' })
      .expect(200);
    expect(declined.body.data.status).toBe('CANCELLED');
    await patient.agent
      .post(`/api/v1/patients/${ananya}/appointment-requests`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ reason: 'REPORT_REVIEW', preferredWindow: 'THIS_WEEK' })
      .expect(201);
    await patient.agent
      .post(`/api/v1/patients/${ananya}/appointment-requests`)
      .set('X-CSRF-Token', patient.csrf)
      .send({ reason: 'OTHER', preferredWindow: 'ANY_TIME' })
      .expect(409);
    const queue = await care.agent.get('/api/v1/care-queue').expect(200);
    expect(
      (queue.body.data as { type: string; origin: string }[]).some(
        (item) => item.type === 'VISIT' && item.origin === 'PATIENT_REQUEST',
      ),
    ).toBe(true);
  });
});

describe('day 92: AI review, exports, ABDM simulation, device, demo console', () => {
  beforeAll(async () => {
    await resetTo(app, 92, '11:00');
  });

  it('records the doctor review of an AI observation (nothing clinical happens)', async () => {
    const doctor = await signIn(app, EMAIL.doctor);
    const result = await doctor.agent
      .post(`/api/v1/patients/${ananya}/ai/requests`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ task: 'DOCTOR_BRIEF_SYNTHESIS' })
      .expect(200);
    const observation = (result.body.data.observations as { id: string }[])[0];
    expect(observation).toBeDefined();
    const reviewed = await doctor.agent
      .post(`/api/v1/ai/recommendations/${observation?.id}/review`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ decision: 'DISMISSED', reason: 'ALREADY_KNOWN' })
      .expect(200);
    expect(reviewed.body.data.status).toBe('DISMISSED');
    await doctor.agent
      .post(`/api/v1/ai/recommendations/${observation?.id}/review`)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ decision: 'ACCEPTED' })
      .expect(409);
    expect(
      await db.auditEvent.count({
        where: { action: 'AI_RECOMMENDATION_REVIEWED', resourceId: observation?.id },
      }),
    ).toBe(1);
  });

  it('exports a FHIR R4 Bundle tagged SYNTHETIC, limited to what the caller may see', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const response = await patient.agent.get(`/api/v1/patients/${ananya}/fhir/export`).expect(200);
    const bundle = response.body.data as {
      resourceType: string;
      type: string;
      meta: { tag: { code: string }[] };
      entry: {
        resource: {
          resourceType: string;
          meta: { tag: { code: string }[] };
          code?: { coding?: { code: string }[] };
        };
      }[];
    };
    expect(bundle).toMatchObject({ resourceType: 'Bundle', type: 'collection' });
    expect(bundle.meta.tag[0]?.code).toBe('SYNTHETIC');
    expect(bundle.entry.every((entry) => entry.resource.meta.tag[0]?.code === 'SYNTHETIC')).toBe(
      true,
    );
    const types = new Set(bundle.entry.map((entry) => entry.resource.resourceType));
    for (const type of [
      'Patient',
      'Organization',
      'Encounter',
      'Condition',
      'AllergyIntolerance',
      'MedicationRequest',
      'Observation',
      'Appointment',
    ]) {
      expect(types.has(type)).toBe(true);
    }
    const hba1c = bundle.entry.filter(
      (entry) => entry.resource.code?.coding?.[0]?.code === '4548-4',
    );
    expect(hba1c.length).toBeGreaterThanOrEqual(2);
    expect(
      await db.auditEvent.count({ where: { action: 'EXPORT', patientProfileId: ananya } }),
    ).toBe(1);

    // Dr. Arjun has no care relationship: nothing clinical to export.
    const arjun = await signIn(app, EMAIL.arjun);
    await arjun.agent.get(`/api/v1/patients/${ananya}/fhir/export`).expect(403);
  });

  it('simulates an ABDM link without touching ABHA fields or the network', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const base = `/api/v1/patients/${ananya}/abdm-simulation`;
    const before = await patient.agent.get(base).expect(200);
    expect(before.body.data).toMatchObject({
      label: 'SIMULATED — not connected to ABDM',
      linked: false,
    });
    await patient.agent.get(`${base}/share-preview`).expect(409);
    const linked = await patient.agent
      .post(`${base}/link`)
      .set('X-CSRF-Token', patient.csrf)
      .expect(200);
    expect(linked.body.data.simulatedAddress).toBe('ananya.demo@simulated');
    expect(linked.body.data.careContexts.length).toBeGreaterThan(0);
    const preview = await patient.agent.get(`${base}/share-preview`).expect(200);
    expect(preview.body.data).toMatchObject({
      sent: false,
      label: 'SIMULATED — not connected to ABDM',
    });
    const profile = await db.patientProfile.findUniqueOrThrow({ where: { id: ananya } });
    expect([profile.abhaNumber, profile.abhaAddress, profile.abhaVerifiedAt]).toEqual([
      null,
      null,
      null,
    ]);
    const doctor = await signIn(app, EMAIL.doctor);
    await doctor.agent.get(base).expect(403);
  });

  it('syncs the synthetic wearable for today', async () => {
    const patient = await signIn(app, EMAIL.patient);
    const sync = await patient.agent
      .post(`/api/v1/patients/${ananya}/devices/sync`)
      .set('X-CSRF-Token', patient.csrf)
      .expect(200);
    expect(sync.body.data).toMatchObject({ adapter: 'synthetic-wearable', daysAdded: 0 });
    expect(sync.body.data.todaySteps).toBeGreaterThan(0);
  });

  it('lets only an admin use the demo console, and a reset signs everyone out', async () => {
    const patient = await signIn(app, EMAIL.patient);
    await patient.agent.get('/api/v1/demo/console').expect(403);
    const admin = await signIn(app, EMAIL.admin);
    const consoleView = await admin.agent.get('/api/v1/demo/console').expect(200);
    expect(consoleView.body.data).toMatchObject({
      currentDay: 92,
      ai: { provider: 'DEMO', claudeAvailable: false },
    });
    await admin.agent
      .post('/api/v1/demo/ai-provider')
      .set('X-CSRF-Token', admin.csrf)
      .send({ provider: 'ANTHROPIC' })
      .expect(409);
    const clock = await admin.agent
      .post('/api/v1/demo/clock')
      .set('X-CSRF-Token', admin.csrf)
      .send({ timeOfDay: '06:25' })
      .expect(200);
    expect(clock.body.data.clock.today).toBe('2026-10-08');
    await admin.agent
      .post('/api/v1/demo/reset')
      .set('X-CSRF-Token', admin.csrf)
      .send({ checkpointDay: 6 })
      .expect(200);
    await patient.agent.get(`/api/v1/patients/${ananya}`).expect(401);
    const state = await (
      await signIn(app, EMAIL.patient)
    ).agent
      .get('/api/v1/demo/state')
      .expect(200);
    expect(state.body.data.clock.offsetDays).toBe(6);
    expect(await db.auditEvent.count({ where: { action: 'DEMO_RESET' } })).toBe(2);
  });
});
