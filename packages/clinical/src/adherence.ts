/**
 * Recorded adherence (Architecture §8.1):
 *
 *   adherence = TAKEN / (TAKEN + SKIPPED + MISSED)
 *
 * for doses scheduled inside the window. Doses still SCHEDULED, REMINDED or
 * SNOOZED are pending and excluded; CANCELLED doses are excluded. The figure
 * is "recorded" because it reflects what the patient reported.
 */
export type DoseStatus =
  'SCHEDULED' | 'REMINDED' | 'SNOOZED' | 'TAKEN' | 'SKIPPED' | 'MISSED' | 'CANCELLED';

export interface DoseRecord {
  planId: string;
  scheduledAt: Date;
  status: DoseStatus;
}

export interface AdherenceCounts {
  taken: number;
  skipped: number;
  missed: number;
  due: number;
  pending: number;
  /** Rounded to a whole percent; null when nothing was due. */
  percentage: number | null;
  /** Longest run of consecutive MISSED doses within any single plan. */
  longestMissedRun: number;
}

export interface AdherenceResult extends AdherenceCounts {
  perPlan: Map<string, AdherenceCounts>;
}

export const ADHERENCE_FORMULA = 'TAKEN ÷ (TAKEN + SKIPPED + MISSED), scheduled inside the window';

const PENDING: ReadonlySet<DoseStatus> = new Set(['SCHEDULED', 'REMINDED', 'SNOOZED']);

function countDoses(doses: readonly DoseRecord[]): AdherenceCounts {
  let taken = 0;
  let skipped = 0;
  let missed = 0;
  let pending = 0;
  for (const dose of doses) {
    if (dose.status === 'TAKEN') taken += 1;
    else if (dose.status === 'SKIPPED') skipped += 1;
    else if (dose.status === 'MISSED') missed += 1;
    else if (PENDING.has(dose.status)) pending += 1;
  }
  const due = taken + skipped + missed;
  const sorted = [...doses].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  let longestMissedRun = 0;
  let run = 0;
  for (const dose of sorted) {
    if (dose.status === 'MISSED') {
      run += 1;
      longestMissedRun = Math.max(longestMissedRun, run);
    } else if (dose.status !== 'CANCELLED') {
      run = 0;
    }
  }
  return {
    taken,
    skipped,
    missed,
    due,
    pending,
    percentage: due === 0 ? null : Math.round((taken / due) * 100),
    longestMissedRun,
  };
}

/** Adherence over [from, to) for all doses given; dose times are instants. */
export function calculateAdherence(
  doses: readonly DoseRecord[],
  window: { from: Date; to: Date },
): AdherenceResult {
  const inWindow = doses.filter(
    (dose) =>
      dose.scheduledAt.getTime() >= window.from.getTime() &&
      dose.scheduledAt.getTime() < window.to.getTime(),
  );
  const byPlan = new Map<string, DoseRecord[]>();
  for (const dose of inWindow) {
    const list = byPlan.get(dose.planId) ?? [];
    list.push(dose);
    byPlan.set(dose.planId, list);
  }
  const perPlan = new Map<string, AdherenceCounts>();
  for (const [planId, planDoses] of byPlan) perPlan.set(planId, countDoses(planDoses));

  const overall = countDoses(inWindow);
  const longestMissedRun = Math.max(
    0,
    ...[...perPlan.values()].map((counts) => counts.longestMissedRun),
  );
  return { ...overall, longestMissedRun, perPlan };
}

/** The first dose of the longest run of consecutive MISSED doses in one plan, or null. */
export function longestMissedRunStart(doses: readonly DoseRecord[]): Date | null {
  const byPlan = new Map<string, DoseRecord[]>();
  for (const dose of doses) {
    byPlan.set(dose.planId, [...(byPlan.get(dose.planId) ?? []), dose]);
  }
  let best: { length: number; start: Date } | null = null;
  for (const planDoses of byPlan.values()) {
    const sorted = [...planDoses].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    let runStart: Date | null = null;
    let length = 0;
    for (const dose of sorted) {
      if (dose.status === 'MISSED') {
        if (length === 0) runStart = dose.scheduledAt;
        length += 1;
        if (runStart && (!best || length > best.length)) best = { length, start: runStart };
      } else if (dose.status !== 'CANCELLED') {
        length = 0;
        runStart = null;
      }
    }
  }
  return best?.start ?? null;
}
