import 'reflect-metadata';
import {
  ACCESS_REASONS,
  CONFIDENCE_LEVELS,
  DATA_CATEGORIES,
  RECORD_SOURCES,
  AI_INTERACTION_STATUSES,
  type SessionRole,
} from '@healthguard/shared';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './common/guards.js';
import { ROLES } from './common/decorators.js';
import { maskPhone } from './common/mapping.js';
import { ProblemException } from './common/problem.js';
import { buildConfig } from './config/env.js';
import {
  AIInteractionStatus,
  Confidence,
  DataCategory,
  RecordSource,
} from './generated/prisma/enums.js';
import { scopeArgs, TenantViolationError } from './infrastructure/prisma/tenant-extension.js';
import { auditContentHash } from './modules/audit/audit-hash.js';

const ORG_A = '019f0000-0000-7000-8000-00000000000a';
const ORG_B = '019f0000-0000-7000-8000-00000000000b';

describe('tenant scoping', () => {
  it('adds the organization to every read of a tenant model', () => {
    expect(scopeArgs('LabResult', 'findMany', { where: { patientProfileId: 'p' } }, ORG_A)).toEqual(
      {
        where: { patientProfileId: 'p', organizationId: ORG_A },
      },
    );
    expect(scopeArgs('PatientProfile', 'findUnique', { where: { id: 'x' } }, ORG_A).where).toEqual({
      id: 'x',
      organizationId: ORG_A,
    });
  });

  it('overrides a caller-supplied organization in a filter', () => {
    const scoped = scopeArgs('Consent', 'count', { where: { organizationId: ORG_B } }, ORG_A);
    expect(scoped.where).toEqual({ organizationId: ORG_A });
  });

  it('rejects writes for another tenant and stamps the tenant on creates', () => {
    expect(() => scopeArgs('Vital', 'create', { data: { organizationId: ORG_B } }, ORG_A)).toThrow(
      TenantViolationError,
    );
    expect(scopeArgs('Vital', 'create', { data: { value: 1 } }, ORG_A).data).toEqual({
      value: 1,
      organizationId: ORG_A,
    });
  });

  it('leaves global reference data alone', () => {
    const args = { where: { code: 'HBA1C' } };
    expect(scopeArgs('LabTest', 'findMany', args, ORG_A)).toBe(args);
  });
});

describe('configuration', () => {
  const base = { DATABASE_URL: 'postgresql://x', NODE_ENV: 'development' } as NodeJS.ProcessEnv;

  it('defaults to the offline demo AI provider and never needs a key', () => {
    const config = buildConfig(base);
    expect(config.aiProvider).toBe('DEMO');
    expect(config.demoAuthEnabled).toBe(false);
  });

  it('enables demo auth only in demo mode', () => {
    expect(buildConfig({ ...base, DEMO_MODE: 'true' }).demoAuthEnabled).toBe(true);
    expect(
      buildConfig({ ...base, DEMO_MODE: 'true', DEMO_AUTH_ENABLED: 'false' }).demoAuthEnabled,
    ).toBe(false);
  });

  it('refuses demo mode in production unless explicitly allowed, and requires JWT keys', () => {
    expect(() => buildConfig({ ...base, NODE_ENV: 'production', DEMO_MODE: 'true' })).toThrow(
      /ALLOW_DEMO_IN_PRODUCTION/,
    );
    expect(() => buildConfig({ ...base, NODE_ENV: 'production' })).toThrow(/JWT keys/);
  });

  it('requires a key for the Anthropic provider when fallback is off', () => {
    expect(() =>
      buildConfig({ ...base, AI_PROVIDER: 'anthropic', AI_FALLBACK_TO_DEMO: 'false' }),
    ).toThrow(/ANTHROPIC_API_KEY/);
    expect(buildConfig({ ...base, AI_PROVIDER: 'anthropic' }).aiProvider).toBe('ANTHROPIC');
  });
});

describe('RolesGuard', () => {
  const guardFor = (required: string[] | undefined, roles: SessionRole[]) => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES ? required : undefined),
    };
    const guard = new RolesGuard(reflector as never);
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ actor: { roles } }) }),
    };
    return () => guard.canActivate(context as never);
  };

  it('lets a care coordinator through a CARE_TEAM route and stops an admin', () => {
    expect(guardFor(['DOCTOR', 'CARE_TEAM'], ['CARE_COORDINATOR'])()).toBe(true);
    expect(guardFor(['DOCTOR', 'CARE_TEAM'], ['ORG_ADMIN'])).toThrow(ProblemException);
    expect(guardFor(undefined, ['PATIENT'])()).toBe(true);
  });
});

describe('contracts stay in sync with the database enums', () => {
  it.each([
    ['DataCategory', DATA_CATEGORIES, DataCategory],
    ['RecordSource', RECORD_SOURCES, RecordSource],
    ['Confidence', CONFIDENCE_LEVELS, Confidence],
    ['AIInteractionStatus', AI_INTERACTION_STATUSES, AIInteractionStatus],
  ] as const)('%s', (_name, shared, prisma) => {
    expect([...shared].sort()).toEqual(Object.values(prisma).sort());
  });

  it('access reasons are unique', () => {
    expect(new Set(ACCESS_REASONS).size).toBe(ACCESS_REASONS.length);
  });
});

describe('small helpers', () => {
  it('masks phone numbers', () => {
    expect(maskPhone('+910000000101')).toBe('+91 ••••• ••101');
    expect(maskPhone(null)).toBeNull();
  });

  it('hashes audit rows deterministically and detects changes', () => {
    const row = {
      id: 'a',
      organizationId: ORG_A,
      occurredAt: new Date('2026-10-08T00:00:00Z'),
      actorType: 'USER' as const,
      actorUserId: null,
      actorRoles: ['DOCTOR'],
      patientProfileId: null,
      action: 'READ' as const,
      resourceType: 'LabResult',
      resourceId: null,
      purposeCode: null,
      decision: 'ALLOW' as const,
      decisionReason: 'ALLOWED',
      outcome: 'SUCCESS' as const,
      requestId: null,
      metadata: { b: 1, a: 2 },
    };
    expect(auditContentHash(row)).toBe(auditContentHash({ ...row, metadata: { a: 2, b: 1 } }));
    expect(auditContentHash(row)).not.toBe(auditContentHash({ ...row, decision: 'DENY' }));
  });
});

describe('Phase 1 rules', () => {
  it('runs the demo clock from a time-of-day jump', async () => {
    const { demoNow } = await import('./infrastructure/clock/clock.service.js');
    const realAt = '2026-10-10T05:00:00.000Z';
    const now = demoNow(
      {
        anchorDay0: '2026-07-08',
        offsetDays: 6,
        timezone: 'Asia/Kolkata',
        timeOfDay: { clock: '08:00', realAt },
      },
      new Date(Date.parse(realAt) + 10 * 60_000),
      'Asia/Kolkata',
    );
    expect(now.toISOString()).toBe('2026-07-14T02:40:00.000Z'); // 08:10 IST on day 6
  });

  it('turns a plan into local dose times from the routine', async () => {
    const { planClockTimes } = await import('./modules/doses/dose-engine.js');
    expect(
      planClockTimes(
        { timingEvents: ['PCM'], timingOffsetMinutes: 15, timesOfDay: [] },
        { breakfast: '08:00' },
      ),
    ).toEqual([{ clock: '08:15', slot: 'PCM+15' }]);
  });

  it('describes numbers that moved together without claiming cause', async () => {
    const { associationSentence } = await import('./modules/activity/progress.service.js');
    const base = { unit: '%', method: '', sourceIds: [], beforeDate: null, afterDate: null };
    const sentence = associationSentence([
      {
        ...base,
        metric: 'HBA1C',
        label: 'HbA1c',
        before: 7.4,
        after: 6.8,
        beforeDate: '2026-07-08',
        afterDate: '2026-10-07',
        direction: 'down',
      },
      {
        ...base,
        metric: 'RECORDED_ADHERENCE',
        label: 'Adherence',
        before: null,
        after: 92,
        direction: null,
      },
    ]);
    expect(sentence).toContain('HbA1c went down (7.4% to 6.8%)');
    expect(sentence).toContain('does not show that one caused the other');
    expect(associationSentence([])).toBeNull();
  });
});
