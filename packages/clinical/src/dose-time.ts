/**
 * Dose times from the patient's daily routine (Data model §6.3): "after
 * breakfast + 15 minutes" is 08:15 for a patient who has breakfast at 08:00.
 * Timing codes follow FHIR EventTiming.
 */
export interface DailyRoutine {
  wake?: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  sleep?: string;
}

type RoutineAnchor = keyof DailyRoutine;

const EVENT_ANCHORS: Record<string, { anchor: RoutineAnchor; direction: 1 | -1 | 0 }> = {
  WAKE: { anchor: 'wake', direction: 0 },
  MORN: { anchor: 'wake', direction: 0 },
  CM: { anchor: 'breakfast', direction: 0 },
  CD: { anchor: 'lunch', direction: 0 },
  CV: { anchor: 'dinner', direction: 0 },
  ACM: { anchor: 'breakfast', direction: -1 },
  ACD: { anchor: 'lunch', direction: -1 },
  ACV: { anchor: 'dinner', direction: -1 },
  PCM: { anchor: 'breakfast', direction: 1 },
  PCD: { anchor: 'lunch', direction: 1 },
  PCV: { anchor: 'dinner', direction: 1 },
  HS: { anchor: 'sleep', direction: -1 },
};

function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new RangeError(`Not a 24-hour HH:MM time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Local `HH:MM` for a timing event, or null when the routine lacks the anchor. */
export function doseClockTime(
  routine: DailyRoutine,
  timingEvent: string,
  offsetMinutes = 0,
): string | null {
  const rule = EVENT_ANCHORS[timingEvent];
  if (!rule) return null;
  const anchor = routine[rule.anchor];
  if (!anchor) return null;
  const base = parseClock(anchor);
  return formatClock(base + rule.direction * offsetMinutes);
}

/** Slot label stored on dose events, e.g. `PCM+15`. */
export function slotLabel(timingEvent: string, offsetMinutes: number | null): string {
  if (!offsetMinutes) return timingEvent;
  const rule = EVENT_ANCHORS[timingEvent];
  const sign = rule?.direction === -1 ? '-' : '+';
  return `${timingEvent}${sign}${offsetMinutes}`;
}
