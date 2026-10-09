import type { BriefClaim, BriefObservation, DoctorBriefSynthesis } from '@healthguard/shared';
import type { Fact, FactSheet } from '../types.js';

/**
 * Deterministic doctor brief built from the fact sheet with fixed sentence
 * templates. Used by the demo provider (no API key needed) and as the
 * fallback when a live model fails validation. It can only restate facts.
 */
const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
];

function formatValue(value: number, unit: string): string {
  const formatted = Number.isInteger(value) ? value.toLocaleString('en-IN') : String(value);
  if (!unit) return formatted;
  return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
}

function num(fact: Fact, key: string): number | null {
  const value = fact.values[key];
  return typeof value === 'number' ? value : null;
}

function str(fact: Fact, key: string): string | null {
  const value = fact.values[key];
  return typeof value === 'string' ? value : null;
}

function byMetric(sheet: FactSheet, metric: string): Fact | undefined {
  return sheet.facts.find((fact) => fact.values.metric === metric);
}

export function composeDoctorBrief(sheet: FactSheet): DoctorBriefSynthesis {
  const summary: BriefClaim[] = [];
  const observations: BriefObservation[] = [];

  // Labs: latest value against the previous one, per test.
  const labsByTest = new Map<string, Fact[]>();
  for (const fact of sheet.facts.filter((item) => item.category === 'LABS')) {
    const test = str(fact, 'testName');
    if (test && num(fact, 'value') !== null)
      labsByTest.set(test, [...(labsByTest.get(test) ?? []), fact]);
  }
  for (const [test, facts] of labsByTest) {
    const sorted = [...facts].sort((a, b) =>
      (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? ''),
    );
    const latest = sorted.at(-1);
    if (!latest) continue;
    const latestValue = num(latest, 'value') ?? 0;
    const unit = str(latest, 'unit') ?? '';
    const previous = sorted.at(-2);
    if (previous) {
      const previousValue = num(previous, 'value') ?? 0;
      const direction =
        latestValue < previousValue
          ? 'down from'
          : latestValue > previousValue
            ? 'up from'
            : 'unchanged from';
      summary.push({
        text: `Latest ${test} is ${formatValue(latestValue, unit)}, ${direction} ${formatValue(previousValue, unit)} at the previous test.`,
        factIds: [latest.id, previous.id],
      });
    } else {
      summary.push({
        text: `Latest ${test} is ${formatValue(latestValue, unit)}.`,
        factIds: [latest.id],
      });
    }
    const high = num(latest, 'referenceHigh');
    if (high !== null && latestValue > high && observations.length < 4) {
      observations.push({
        type: 'DISCUSSION_POINT',
        text: `Latest ${test} (${formatValue(latestValue, unit)}) is above the reference range upper limit of ${formatValue(high, unit)}.`,
        rationale: "Recorded lab value compared with the laboratory's reference range.",
        confidence: 'HIGH',
        factIds: [latest.id],
      });
    }
  }

  const adherence = byMetric(sheet, 'RECORDED_ADHERENCE');
  if (adherence) {
    const percentage = num(adherence, 'percentage');
    const taken = num(adherence, 'taken');
    const due = num(adherence, 'due');
    if (percentage !== null && taken !== null && due !== null) {
      summary.push({
        text: `Recorded adherence since the last visit is ${percentage}% (${taken} of ${due} doses).`,
        factIds: [adherence.id],
      });
    }
  }

  const steps = byMetric(sheet, 'AVERAGE_DAILY_STEPS');
  const weight = byMetric(sheet, 'BODY_WEIGHT_CHANGE');
  const parts: string[] = [];
  const cited: string[] = [];
  if (steps && num(steps, 'before') !== null && num(steps, 'after') !== null) {
    const before = num(steps, 'before') ?? 0;
    const after = num(steps, 'after') ?? 0;
    const verb = after > before ? 'rose' : after < before ? 'fell' : 'stayed';
    parts.push(
      verb === 'stayed'
        ? `average daily steps stayed at ${formatValue(after, '')}`
        : `average daily steps ${verb} from ${formatValue(before, '')} to ${formatValue(after, '')}`,
    );
    cited.push(steps.id);
  }
  if (weight && num(weight, 'from') !== null && num(weight, 'to') !== null) {
    const unit = str(weight, 'unit') ?? 'kg';
    parts.push(
      `weight went from ${formatValue(num(weight, 'from') ?? 0, unit)} to ${formatValue(num(weight, 'to') ?? 0, unit)}`,
    );
    cited.push(weight.id);
  }
  if (parts.length > 0) {
    summary.push({ text: `Over the same period, ${parts.join(' and ')}.`, factIds: cited });
  }

  const missedRun = byMetric(sheet, 'LONGEST_MISSED_RUN');
  const runLength = missedRun ? num(missedRun, 'length') : null;
  if (missedRun && runLength !== null && runLength >= 2 && observations.length < 4) {
    const words = NUMBER_WORDS[runLength] ?? String(runLength);
    observations.push({
      type: 'QUESTION_FOR_CLINICIAN',
      text: `${words} consecutive doses were missed at one point; you may want to ask what happened.`,
      rationale: 'Longest run of consecutive missed doses in the recorded dose history.',
      confidence: 'MEDIUM',
      factIds: [missedRun.id],
    });
  }

  return {
    summary: summary.slice(0, 6),
    observations: observations.slice(0, 4),
    insufficientData: summary.length === 0,
  };
}
