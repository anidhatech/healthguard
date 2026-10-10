/**
 * Background worker (BullMQ on Redis):
 * - `dose-engine` every minute: creates today's doses from signed plans, sends
 *   simulated phone reminders, infers missed doses and raises call-backs.
 * - `expire-consents` hourly.
 * Nothing here contacts an outside service; reminders go to the in-app
 * simulated phone.
 */
import { Queue, Worker, type Job } from 'bullmq';
import { buildConfig } from './config/env.js';
import { loadRootEnv } from './config/load-env.js';
import { createPrismaClient } from './infrastructure/prisma/create-client.js';
import { readDemoClock } from './infrastructure/clock/clock.service.js';
import { auditContentHash } from './modules/audit/audit-hash.js';
import { runDoseEngine } from './modules/doses/dose-engine.js';
import { randomUUID } from 'node:crypto';

const QUEUE = 'maintenance';

export async function expireConsents(
  db: ReturnType<typeof createPrismaClient>,
  now = new Date(),
): Promise<number> {
  const due = await db.consent.findMany({
    where: { status: 'GRANTED', validUntil: { lte: now } },
    select: { id: true, organizationId: true, patientProfileId: true },
  });
  for (const consent of due) {
    await db.consent.update({ where: { id: consent.id }, data: { status: 'EXPIRED' } });
    const row = {
      id: randomUUID(),
      organizationId: consent.organizationId,
      occurredAt: new Date(),
      actorType: 'SYSTEM' as const,
      actorUserId: null,
      actorRoles: ['SYSTEM'],
      patientProfileId: consent.patientProfileId,
      action: 'STATUS_CHANGE' as const,
      resourceType: 'Consent',
      resourceId: consent.id,
      purposeCode: null,
      decision: 'NOT_APPLICABLE' as const,
      decisionReason: 'EXPIRED',
      outcome: 'SUCCESS' as const,
      requestId: null,
      metadata: { job: 'expire-consents' },
    };
    await db.auditEvent.create({ data: { ...row, contentHash: auditContentHash(row) } });
  }
  return due.length;
}

async function main(): Promise<void> {
  loadRootEnv();
  const config = buildConfig();
  const db = createPrismaClient(config.env.DATABASE_URL);
  const connection = { url: config.env.REDIS_URL };
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler(
    'expire-consents',
    { every: 60 * 60 * 1000 },
    { name: 'expire-consents' },
  );
  await queue.upsertJobScheduler('dose-engine', { every: 60 * 1000 }, { name: 'dose-engine' });

  const worker = new Worker(
    QUEUE,
    async (job: Job) => {
      switch (job.name) {
        case 'expire-consents':
          return { expired: await expireConsents(db) };
        case 'dose-engine':
          return runDoseEngine(db, {
            demo: config.demoMode ? await readDemoClock(db) : null,
            real: new Date(),
          });
        default:
          return { skipped: job.name };
      }
    },
    { connection, concurrency: 1 },
  );
  worker.on('completed', (job, result) => console.warn(`[worker] ${job.name} done`, result));
  worker.on('failed', (job, error) =>
    console.error(`[worker] ${job?.name ?? 'job'} failed: ${error.message}`),
  );
  console.warn('[worker] started: dose-engine (every minute), expire-consents (hourly)');

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  main().catch((error: unknown) => {
    console.error('[worker] failed to start:', error);
    process.exit(1);
  });
}
