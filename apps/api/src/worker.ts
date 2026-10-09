/**
 * Background worker (BullMQ on Redis). Phase 1 runs maintenance only:
 * expiring consents whose validity window has passed. Reminders, missed-dose
 * inference and notification delivery are the next phase.
 */
import { Queue, Worker, type Job } from 'bullmq';
import { buildConfig } from './config/env.js';
import { loadRootEnv } from './config/load-env.js';
import { createPrismaClient } from './infrastructure/prisma/create-client.js';
import { auditContentHash } from './modules/audit/audit-hash.js';
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

  const worker = new Worker(
    QUEUE,
    async (job: Job) => {
      switch (job.name) {
        case 'expire-consents':
          return { expired: await expireConsents(db) };
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
  console.warn('[worker] maintenance worker started');

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
