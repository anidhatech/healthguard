/**
 * `pnpm db:seed`: resets the database to the synthetic demo scenario.
 * DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
import { DEMO_DATA_NOTICE } from '@healthguard/shared';
import { createPrismaClient } from '../../src/infrastructure/prisma/create-client.js';
import { seedDemoData } from './run.js';

export const DEFAULT_DEMO_PASSWORD = 'HealthGuard-Demo-2026';

const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

async function main(): Promise<void> {
  if (process.env.DEMO_MODE !== 'true' && process.env.SEED_FORCE !== 'true') {
    throw new Error(
      'The demo seed only runs with DEMO_MODE=true (or SEED_FORCE=true). It replaces all data.',
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const db = createPrismaClient(url);
  try {
    const passwordHash = await hash(process.env.DEMO_ACCOUNT_PASSWORD ?? DEFAULT_DEMO_PASSWORD);
    const started = Date.now();
    const hero = await seedDemoData(db, { passwordHash });
    console.warn(`[seed] ${DEMO_DATA_NOTICE}`);
    console.warn(
      `[seed] Demo data ready in ${Date.now() - started} ms. Hero numbers verified:`,
      hero,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
