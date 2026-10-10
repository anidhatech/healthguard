/**
 * Shared harness for integration tests: the real Nest app against PostgreSQL
 * and Redis. Uses TEST_DATABASE_URL (default: the healthguard_test database),
 * never the development database.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { buildConfig } from '../src/config/env.js';
import { loadRootEnv } from '../src/config/load-env.js';
import { ClockService, type DemoClock } from '../src/infrastructure/clock/clock.service.js';
import { createPrismaClient } from '../src/infrastructure/prisma/create-client.js';
import { seedDemoData } from '../src/modules/demo/seed/run.js';

loadRootEnv();
export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://healthguard:healthguard@localhost:5432/healthguard_test';
if (!/test/i.test(DATABASE_URL))
  throw new Error('Integration tests only run against a *test* database.');

export const testConfig = buildConfig({
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
  IDENTIFIER_HASH_KEY: 'integration-tests-only',
});

export const db = createPrismaClient(DATABASE_URL);
let passwordHash: string | null = null;

export async function startApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(testConfig)],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, testConfig);
  await app.init();
  return app;
}

/** Reseeds the test database at a story checkpoint, optionally at a time of day. */
export async function resetTo(
  app: INestApplication | null,
  checkpointDay: number,
  timeOfDay?: string,
): Promise<void> {
  passwordHash ??= await hash('HealthGuard-Demo-2026');
  await seedDemoData(db, { passwordHash, checkpointDay });
  if (timeOfDay) await setTimeOfDay(app, timeOfDay);
  app?.get(ClockService).invalidate();
}

/** Jumps the demo clock to a local time on the current demo day. */
export async function setTimeOfDay(app: INestApplication | null, clock: string): Promise<void> {
  const row = await db.systemSetting.findUniqueOrThrow({ where: { key: 'demo.clock' } });
  const value = {
    ...(row.value as unknown as DemoClock),
    timeOfDay: { clock, realAt: new Date().toISOString() },
  };
  await db.systemSetting.update({ where: { key: 'demo.clock' }, data: { value } });
  app?.get(ClockService).invalidate();
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

export async function signIn(app: INestApplication, email: string): Promise<Session> {
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

export const EMAIL = {
  patient: 'patient@healthguard.demo',
  doctor: 'doctor@healthguard.demo',
  admin: 'admin@healthguard.demo',
  care: 'care@healthguard.demo',
  arjun: 'arjun.reddy@healthguard.demo',
  rahul: 'rahul.mehta@healthguard.demo',
  priya: 'priya.nair@healthguard.demo',
  platform: 'platform@healthguard.demo',
  lakeview: 'lakeview.doctor@healthguard.demo',
} as const;
