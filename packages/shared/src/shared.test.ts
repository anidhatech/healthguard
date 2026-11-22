import { describe, expect, it } from 'vitest';
import {
  addDays,
  ageInYears,
  DEMO_ACCOUNTS,
  DEMO_DATA_NOTICE,
  DoctorBriefSynthesisSchema,
  homeAreaForRoles,
  localIsoDate,
  parseIsoDate,
  problemType,
  resolveLocale,
  satisfiesAnyRole,
  stableStringify,
  timeZoneOffsetMinutes,
  toIsoDate,
  zonedDayStart,
} from './index.js';

describe('demo notice', () => {
  it('is the exact banner text required on every screen', () => {
    expect(DEMO_DATA_NOTICE).toBe('DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE');
  });

  it('lists the three required demo accounts first', () => {
    const primary = DEMO_ACCOUNTS.filter((account) => account.primary).map((a) => a.email);
    expect(primary).toEqual([
      'patient@healthguard.demo',
      'doctor@healthguard.demo',
      'admin@healthguard.demo',
    ]);
  });
});

describe('roles', () => {
  it('CARE_TEAM is satisfied by a nurse or a care coordinator, not by a doctor', () => {
    expect(satisfiesAnyRole(['CARE_COORDINATOR'], ['CARE_TEAM'])).toBe(true);
    expect(satisfiesAnyRole(['NURSE'], ['CARE_TEAM'])).toBe(true);
    expect(satisfiesAnyRole(['DOCTOR'], ['CARE_TEAM'])).toBe(false);
  });

  it('matches concrete roles and rejects missing ones', () => {
    expect(satisfiesAnyRole(['PATIENT'], ['DOCTOR', 'PATIENT'])).toBe(true);
    expect(satisfiesAnyRole(['PATIENT'], ['ORG_ADMIN', 'PLATFORM_ADMIN'])).toBe(false);
    expect(satisfiesAnyRole([], ['PATIENT'])).toBe(false);
  });

  it('routes each persona to its home area', () => {
    expect(homeAreaForRoles(['PATIENT'])).toBe('patient');
    expect(homeAreaForRoles(['DOCTOR'])).toBe('doctor');
    expect(homeAreaForRoles(['CARE_COORDINATOR'])).toBe('doctor');
    expect(homeAreaForRoles(['ORG_ADMIN'])).toBe('admin');
    expect(homeAreaForRoles(['PLATFORM_ADMIN'])).toBe('admin');
  });
});

describe('locales', () => {
  it('falls back to English (India) for unknown values', () => {
    expect(resolveLocale('te-IN')).toBe('te-IN');
    expect(resolveLocale('fr-FR')).toBe('en-IN');
    expect(resolveLocale(undefined)).toBe('en-IN');
  });
});

describe('time helpers', () => {
  it('round-trips calendar dates and rejects impossible ones', () => {
    expect(toIsoDate(parseIsoDate('2026-07-08'))).toBe('2026-07-08');
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
    expect(toIsoDate(addDays(parseIsoDate('2026-07-08'), 92))).toBe('2026-10-08');
  });

  it('computes local dates in India time', () => {
    // 20:00 UTC on 7 July is 01:30 on 8 July in Asia/Kolkata.
    expect(localIsoDate(new Date('2026-07-07T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-07-08');
  });

  it('computes completed years of age', () => {
    expect(ageInYears(parseIsoDate('1968-03-14'), parseIsoDate('2026-10-08'))).toBe(58);
    expect(ageInYears(parseIsoDate('1968-12-14'), parseIsoDate('2026-10-08'))).toBe(57);
  });
});

describe('time zones', () => {
  it('knows India is UTC+05:30 all year', () => {
    expect(timeZoneOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(timeZoneOffsetMinutes(new Date('2026-07-15T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
  });

  it('finds the instant a local day starts', () => {
    expect(zonedDayStart('2026-10-08', 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-07T18:30:00.000Z',
    );
    expect(zonedDayStart('2026-10-08', 'UTC').toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });
});

describe('stableStringify', () => {
  it('sorts keys so equal objects serialize equally', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(
      stableStringify({ a: [2, { c: 4, d: 3 }], b: 1 }),
    );
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('AI output schema', () => {
  it('accepts a cited brief and rejects uncited or extra fields', () => {
    const valid = {
      summary: [{ text: 'Recorded adherence is 92%.', factIds: ['c-02'] }],
      observations: [],
      insufficientData: false,
    };
    expect(DoctorBriefSynthesisSchema.safeParse(valid).success).toBe(true);
    expect(
      DoctorBriefSynthesisSchema.safeParse({
        ...valid,
        summary: [{ text: 'No citation.', factIds: [] }],
      }).success,
    ).toBe(false);
    expect(DoctorBriefSynthesisSchema.safeParse({ ...valid, diagnosis: 'anything' }).success).toBe(
      false,
    );
  });
});

describe('problem types', () => {
  it('builds stable problem URIs', () => {
    expect(problemType('ACCESS_DENIED')).toBe('https://healthguard.example/problems/access-denied');
  });
});

describe('ABHA helpers', () => {
  it('checks each ABHA address rule on its own', async () => {
    const { abhaAddressRules } = await import('./schemas/abha.js');
    const met = (handle: string) =>
      Object.fromEntries(abhaAddressRules(handle, '@sbx').map((rule) => [rule.key, rule.met]));
    // Eight characters before the suffix at least; eighteen with it at most.
    expect(met('abcdef')).toMatchObject({ length: false });
    expect(met('abcdefgh')).toMatchObject({ length: true });
    expect(met('abcdefghijklmn')).toMatchObject({ length: true });
    expect(met('abcdefghijklmno')).toMatchObject({ length: false });
    expect(met('test.person')).toEqual({
      length: true,
      characters: true,
      specials: true,
      edges: true,
    });
    expect(met('abc')).toMatchObject({ length: false });
    expect(met('abcdefghijklmnop')).toMatchObject({ length: false });
    expect(met('test person!')).toMatchObject({ characters: false });
    expect(met('a.b.c_d')).toMatchObject({ specials: false });
    expect(met('a_b_c.d')).toMatchObject({ specials: false });
    expect(met('.test')).toMatchObject({ edges: false });
    expect(met('test_')).toMatchObject({ edges: false });
    expect(met('')).toMatchObject({ edges: false, characters: false });
  });

  it('masks an Aadhaar number to its last four digits', async () => {
    const { maskAadhaar } = await import('./schemas/abha.js');
    expect(maskAadhaar('000011112222')).toBe('XXXX XXXX 2222');
    expect(maskAadhaar('12345')).toBe('XXXXX');
  });

  it('shows the consent declarations to a private entity without the word government', async () => {
    const consent = await import('./abha-consent.js');
    expect(consent.ABHA_DECLARATIONS.map((item) => item.key)).toEqual([
      'aadhaarSharing',
      'otherDocument',
      'recordsLinking',
      'recordsSharing',
      'anonymizedUse',
    ]);
    expect(JSON.stringify(consent.ABHA_DECLARATIONS)).not.toMatch(/government/i);
    expect(consent.ABHA_TERMS_AND_CONDITIONS.startsWith('I, hereby declare')).toBe(true);
    expect(consent.abhaWorkerConfirmation('A B')).toContain('I, A B, confirm');
    expect(consent.abhaBeneficiaryConfirmation('C D')).toContain('I, C D, have been explained');
  });
});

describe('ABHA login methods', () => {
  it('offers only the OTP routes an ABHA address lists, however ABDM spells them', async () => {
    const { abhaLoginMethodsFrom } = await import('./schemas/abha.js');
    expect(abhaLoginMethodsFrom(['AADHAAR_OTP', 'MOBILE_OTP', 'PASSWORD'])).toEqual([
      'AADHAAR_OTP',
      'MOBILE_OTP',
    ]);
    expect(abhaLoginMethodsFrom(['MOBILE_OTP'])).toEqual(['MOBILE_OTP']);
    expect(abhaLoginMethodsFrom(['mobile-otp', 'Aadhaar OTP', 'AADHAAR_OTP'])).toEqual([
      'MOBILE_OTP',
      'AADHAAR_OTP',
    ]);
    expect(abhaLoginMethodsFrom(['PASSWORD', 'AADHAAR_BIO', 'DEMOGRAPHICS'])).toEqual([]);
    expect(abhaLoginMethodsFrom([])).toEqual([]);
  });
});
