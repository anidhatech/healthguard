import { Injectable } from '@nestjs/common';
import { averageOverWindow } from '@healthguard/clinical';
import {
  addDays,
  parseIsoDate,
  toIsoDate,
  zonedDayStart,
  type DataCategory,
  type ProgressMetric,
  type ProgressSummary,
} from '@healthguard/shared';
import { dateOnly, num } from '../../common/mapping.js';
import type { PatientProfile } from '../../generated/prisma/client.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AdherenceService } from '../adherence/adherence.service.js';

export const PROGRESS_CATEGORY: Record<ProgressMetric, DataCategory> = {
  HBA1C: 'LABS',
  BODY_WEIGHT: 'VITALS',
  AVERAGE_DAILY_STEPS: 'ACTIVITY',
  RECORDED_ADHERENCE: 'ADHERENCE',
};

type Metric = ProgressSummary['metrics'][number];

function direction(before: number | null, after: number | null): Metric['direction'] {
  if (before === null || after === null) return null;
  return after > before ? 'up' : after < before ? 'down' : 'same';
}

const WORDS = { up: 'went up', down: 'went down', same: 'stayed the same' } as const;

/**
 * A calculated sentence about numbers that moved over the same period. It
 * names the period and the values, and always says it does not show cause.
 */
export function associationSentence(metrics: readonly Metric[]): string | null {
  const hba1c = metrics.find((metric) => metric.metric === 'HBA1C');
  const adherence = metrics.find((metric) => metric.metric === 'RECORDED_ADHERENCE');
  if (!hba1c?.direction || hba1c.before === null || hba1c.after === null || !hba1c.beforeDate) {
    return null;
  }
  if (adherence?.after === null || adherence?.after === undefined) return null;
  const steps = metrics.find((metric) => metric.metric === 'AVERAGE_DAILY_STEPS');
  const stepsPart =
    steps?.before !== null && steps?.before !== undefined && steps.after !== null && steps.direction
      ? `, average daily steps ${WORDS[steps.direction]} (${steps.before.toLocaleString('en-IN')} to ${steps.after.toLocaleString('en-IN')})`
      : '';
  return (
    `From ${hba1c.beforeDate} to ${hba1c.afterDate ?? 'now'}, HbA1c ${WORDS[hba1c.direction]} ` +
    `(${hba1c.before}% to ${hba1c.after}%) while recorded adherence was ${adherence.after}%${stepsPart}. ` +
    'These changes happened over the same period; this does not show that one caused the other.'
  );
}

/** Deterministic "since the last visit" comparisons for the dashboards and the AI fact sheet. */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly adherence: AdherenceService,
  ) {}

  async compute(
    patient: PatientProfile,
    allowed: readonly DataCategory[],
  ): Promise<ProgressSummary> {
    const db = this.prisma.tenant(patient.organizationId);
    const today = await this.clock.today(patient.timezone);
    const lastVisit = await this.adherence.lastVisitDate(patient, today);
    const visitEnd = lastVisit
      ? zonedDayStart(toIsoDate(addDays(parseIsoDate(lastVisit), 1)), patient.timezone)
      : null;
    const metrics: Metric[] = [];
    const hidden: ProgressMetric[] = [];
    const can = (metric: ProgressMetric) => {
      const ok = allowed.includes(PROGRESS_CATEGORY[metric]);
      if (!ok) hidden.push(metric);
      return ok;
    };

    if (can('HBA1C')) {
      const results = await db.labResult.findMany({
        where: {
          patientProfileId: patient.id,
          recordStatus: 'ACTIVE',
          labTest: { code: 'HBA1C' },
          // Values read from a report count only after the patient confirms them.
          NOT: { recordSource: 'DOCUMENT_EXTRACTION', verification: 'UNVERIFIED' },
        },
        orderBy: { effectiveAt: 'asc' },
      });
      const after = results.at(-1);
      const before = visitEnd
        ? [...results].reverse().find((row) => row.effectiveAt < visitEnd && row !== after)
        : results.at(-2);
      metrics.push({
        metric: 'HBA1C',
        label: 'HbA1c',
        unit: '%',
        before: num(before?.valueNumeric),
        beforeDate: before ? dateOnly(before.effectiveAt) : null,
        after: num(after?.valueNumeric),
        afterDate: after ? dateOnly(after.effectiveAt) : null,
        direction: direction(num(before?.valueNumeric), num(after?.valueNumeric)),
        method: 'Latest result compared with the result at (or before) the last visit',
        sourceIds: [before?.id, after?.id].filter((id): id is string => Boolean(id)),
      });
    }

    if (can('BODY_WEIGHT')) {
      const weights = await db.vital.findMany({
        where: { patientProfileId: patient.id, type: 'BODY_WEIGHT', recordStatus: 'ACTIVE' },
        orderBy: { measuredAt: 'asc' },
      });
      const after = weights.at(-1);
      const before = visitEnd
        ? [...weights].reverse().find((row) => row.measuredAt < visitEnd)
        : weights[0];
      metrics.push({
        metric: 'BODY_WEIGHT',
        label: 'Body weight',
        unit: 'kg',
        before: num(before?.value),
        beforeDate: before ? dateOnly(before.measuredAt) : null,
        after: num(after?.value),
        afterDate: after ? dateOnly(after.measuredAt) : null,
        direction: direction(num(before?.value), num(after?.value)),
        method: 'Latest weight compared with the weight at the last visit',
        sourceIds: [before?.id, after?.id].filter((id): id is string => Boolean(id)),
      });
    }

    if (can('AVERAGE_DAILY_STEPS')) {
      const rows = await db.activityMetric.findMany({
        where: { patientProfileId: patient.id, type: 'STEPS', recordStatus: 'ACTIVE' },
      });
      const points = rows.map((row) => ({ date: dateOnly(row.date), value: num(row.value) ?? 0 }));
      const shift = (date: string, days: number) => toIsoDate(addDays(parseIsoDate(date), days));
      const before = lastVisit
        ? averageOverWindow(points, shift(lastVisit, -30), shift(lastVisit, -1), 20)
        : null;
      const after = averageOverWindow(points, shift(today, -30), shift(today, -1), 20);
      metrics.push({
        metric: 'AVERAGE_DAILY_STEPS',
        label: 'Average daily steps',
        unit: 'steps',
        before: before?.value ?? null,
        beforeDate: before ? before.to : null,
        after: after.value,
        afterDate: after.to,
        direction: direction(before?.value ?? null, after.value),
        method:
          '30-day averages: before the last visit, and the last 30 days (at least 20 days with data)',
        sourceIds: [],
      });
    }

    if (can('RECORDED_ADHERENCE')) {
      const summary = await this.adherence.summary(patient);
      metrics.push({
        metric: 'RECORDED_ADHERENCE',
        label: 'Recorded adherence since the last visit',
        unit: '%',
        before: null,
        beforeDate: null,
        after: summary.percentage,
        afterDate: summary.to,
        direction: null,
        method: `${summary.formula} (${summary.taken} of ${summary.due} doses)`,
        sourceIds: [],
      });
    }

    return {
      kind: 'CALCULATED',
      lastVisitDate: lastVisit,
      asOf: today,
      metrics,
      hiddenMetrics: hidden,
      association: associationSentence(metrics),
    };
  }
}
