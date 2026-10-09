import { describe, expect, it } from 'vitest';
import {
  averageOverWindow,
  calculateAdherence,
  checkInstructionPreservation,
  doseClockTime,
  longestMissedRunStart,
  renderDoseInstruction,
  slotLabel,
  type DoseRecord,
  type DoseStatus,
} from './index.js';

function dosesFor(planId: string, statuses: DoseStatus[]): DoseRecord[] {
  const start = Date.UTC(2026, 6, 9, 2, 45); // 08:15 IST on day 1
  return statuses.map((status, index) => ({
    planId,
    status,
    scheduledAt: new Date(start + index * 86_400_000),
  }));
}

describe('calculateAdherence', () => {
  it('reproduces the hero figure: 166 of 180 recorded doses is 92%', () => {
    const pattern: DoseStatus[] = [
      ...Array<DoseStatus>(83).fill('TAKEN'),
      ...Array<DoseStatus>(5).fill('MISSED'),
      ...Array<DoseStatus>(2).fill('SKIPPED'),
    ];
    const doses = [...dosesFor('metformin', pattern), ...dosesFor('telmisartan', pattern)];
    const result = calculateAdherence(doses, {
      from: new Date('2026-07-09T00:00:00Z'),
      to: new Date('2026-10-08T00:00:00Z'),
    });
    expect(result.taken).toBe(166);
    expect(result.due).toBe(180);
    expect(result.percentage).toBe(92);
    expect(result.perPlan.get('metformin')?.percentage).toBe(92);
  });

  it('excludes pending and cancelled doses and handles an empty window', () => {
    const doses = dosesFor('p', ['TAKEN', 'SCHEDULED', 'SNOOZED', 'CANCELLED', 'MISSED']);
    const result = calculateAdherence(doses, {
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
    });
    expect(result).toMatchObject({ taken: 1, missed: 1, due: 2, pending: 2, percentage: 50 });
    const empty = calculateAdherence([], {
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
    });
    expect(empty.percentage).toBeNull();
  });

  it('finds the longest run of consecutive missed doses per plan, and where it starts', () => {
    const doses = dosesFor('p', ['TAKEN', 'MISSED', 'MISSED', 'TAKEN', 'MISSED']);
    const result = calculateAdherence(doses, {
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
    });
    expect(result.longestMissedRun).toBe(2);
    expect(longestMissedRunStart(doses)?.toISOString()).toBe(doses[1]?.scheduledAt.toISOString());
    expect(longestMissedRunStart(dosesFor('p', ['TAKEN']))).toBeNull();
  });
});

describe('averageOverWindow', () => {
  it('averages inclusive windows and refuses to guess with too little data', () => {
    const points = [
      { date: '2026-06-01', value: 5000 },
      { date: '2026-06-02', value: 5400 },
      { date: '2026-06-03', value: 5200 },
    ];
    expect(averageOverWindow(points, '2026-06-01', '2026-06-03', 3)).toMatchObject({
      value: 5200,
      daysWithData: 3,
      windowDays: 3,
    });
    expect(averageOverWindow(points, '2026-06-01', '2026-06-30', 20).value).toBeNull();
  });
});

describe('doseClockTime', () => {
  const routine = { wake: '06:30', breakfast: '08:00', lunch: '13:30', dinner: '20:30' };

  it('places "15 minutes after breakfast" at 08:15', () => {
    expect(doseClockTime(routine, 'PCM', 15)).toBe('08:15');
    expect(slotLabel('PCM', 15)).toBe('PCM+15');
  });

  it('handles "before" events and unknown anchors', () => {
    expect(doseClockTime(routine, 'ACV', 30)).toBe('20:00');
    expect(slotLabel('ACV', 30)).toBe('ACV-30');
    expect(doseClockTime(routine, 'HS', 0)).toBeNull();
    expect(doseClockTime(routine, 'UNKNOWN', 0)).toBeNull();
  });
});

describe('renderDoseInstruction', () => {
  const metformin = {
    drugName: 'Metformin',
    strength: '500 mg',
    doseQuantity: 1,
    doseUnit: 'TABLET',
    frequency: 1,
    period: 1,
    periodUnit: 'DAY' as const,
    timingEvents: ['PCM'],
    timingOffsetMinutes: 15,
    durationDays: 90,
  };

  it.each([
    [
      'en-IN',
      'Take 1 tablet of Metformin 500 mg, 15 minutes after breakfast. Once a day, for 90 days.',
    ],
    [
      'hi-IN',
      'नाश्ता करने के 15 मिनट बाद Metformin 500 mg की 1 टैबलेट लें। दिन में एक बार, 90 दिनों तक।',
    ],
    [
      'te-IN',
      'ఉదయం టిఫిన్ చేసిన 15 నిమిషాల తర్వాత Metformin 500 mg 1 టాబ్లెట్ తీసుకోండి. రోజుకు ఒకసారి, 90 రోజుల పాటు.',
    ],
  ] as const)('renders the reviewed %s sentence exactly', (locale, expected) => {
    const result = renderDoseInstruction(metformin, locale);
    expect(result).toEqual({ ok: true, text: expected, templateKey: 'oral-solid@1' });
    if (result.ok) expect(checkInstructionPreservation(result.text, metformin).passed).toBe(true);
  });

  it('renders long-term plans without a duration', () => {
    const result = renderDoseInstruction(
      {
        ...metformin,
        drugName: 'Telmisartan',
        strength: '40 mg',
        timingEvents: ['MORN'],
        timingOffsetMinutes: null,
        durationDays: null,
      },
      'en-IN',
    );
    expect(result).toMatchObject({
      ok: true,
      text: 'Take 1 tablet of Telmisartan 40 mg, in the morning. Once a day.',
    });
  });

  it('refuses plans no reviewed template covers', () => {
    expect(renderDoseInstruction({ ...metformin, doseUnit: 'ML' }, 'en-IN').ok).toBe(false);
    expect(renderDoseInstruction({ ...metformin, frequency: 3 }, 'hi-IN').ok).toBe(false);
  });

  it('flags a changed dose in a rendered text', () => {
    const tampered =
      'Take 2 tablets of Metformin 500 mg, 15 minutes after breakfast. Once a day, for 90 days.';
    const check = checkInstructionPreservation(tampered, metformin);
    expect(check.passed).toBe(false);
    expect(check.problems).toContain('unexpected number 2');
  });
});
