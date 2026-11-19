import { describe, expect, it } from 'vitest';
import { cn, formatDate, formatNumber, showsDemoNotice } from './utils';

describe('utils', () => {
  it('merges class names with Tailwind precedence', () => {
    const hidden: string | false = false;
    expect(cn('p-2', hidden, 'p-4')).toBe('p-4');
  });

  it('formats dates in India time and numbers with Latin digits', () => {
    expect(formatDate('2026-10-08', 'en-IN')).toBe('8 Oct 2026');
    expect(formatNumber(7100)).toBe('7,100');
    expect(formatNumber(null)).toBe('—');
  });
});

describe('the demo data notice', () => {
  const demo = { isDemo: true };
  const clinic = { isDemo: false };

  it('stays on before sign-in and while the session is loading', () => {
    expect(showsDemoNotice(null)).toBe(true);
    expect(showsDemoNotice(undefined)).toBe(true);
  });

  it('follows the organization the person is working in', () => {
    expect(showsDemoNotice({ activeOrganization: demo, patientProfiles: [] })).toBe(true);
    expect(showsDemoNotice({ activeOrganization: clinic, patientProfiles: [] })).toBe(false);
  });

  it('for a patient, comes off only when none of their records is in a demo organization', () => {
    const profile = (organization: { isDemo: boolean }) => ({ organization });
    expect(showsDemoNotice({ activeOrganization: null, patientProfiles: [profile(clinic)] })).toBe(
      false,
    );
    expect(
      showsDemoNotice({
        activeOrganization: null,
        patientProfiles: [profile(clinic), profile(demo)],
      }),
    ).toBe(true);
    expect(showsDemoNotice({ activeOrganization: null, patientProfiles: [] })).toBe(true);
  });
});
