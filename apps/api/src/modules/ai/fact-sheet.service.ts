import { Injectable } from '@nestjs/common';
import type { Fact, FactCategory, FactSheet } from '@healthguard/ai';
import { addDays, parseIsoDate, zonedDayStart, type DataCategory } from '@healthguard/shared';
import { dateOnly, num, strength } from '../../common/mapping.js';
import type { PatientProfile } from '../../generated/prisma/client.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ProgressService } from '../activity/progress.service.js';
import { AdherenceService } from '../adherence/adherence.service.js';

/**
 * Builds the only input an AI provider ever sees: numbered facts (`f-NN`)
 * and calculations (`c-NN`) from categories the caller may access. No names,
 * phone numbers, record numbers or free-text notes are included.
 */
@Injectable()
export class FactSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly progress: ProgressService,
    private readonly adherence: AdherenceService,
  ) {}

  async build(patient: PatientProfile, allowed: readonly DataCategory[]): Promise<FactSheet> {
    const db = this.prisma.tenant(patient.organizationId);
    const today = await this.clock.today(patient.timezone);
    const can = (category: FactCategory) => allowed.includes(category);
    const facts: Fact[] = [];
    let factCount = 0;
    let calcCount = 0;
    const fact = (
      category: FactCategory,
      text: string,
      values: Fact['values'],
      effectiveDate: string | null,
      source: Fact['source'],
    ) => {
      factCount += 1;
      facts.push({
        id: `f-${String(factCount).padStart(2, '0')}`,
        kind: 'FACT',
        category,
        text,
        values,
        effectiveDate,
        source,
      });
    };
    const calc = (category: FactCategory, text: string, values: Fact['values'], label: string) => {
      calcCount += 1;
      facts.push({
        id: `c-${String(calcCount).padStart(2, '0')}`,
        kind: 'CALCULATED',
        category,
        text,
        values,
        effectiveDate: today,
        source: { type: 'Calculation', id: null, label },
      });
    };

    if (can('ENCOUNTERS')) {
      const visit = await db.encounter.findFirst({
        where: {
          patientProfileId: patient.id,
          status: 'COMPLETED',
          startedAt: { lt: zonedDayStart(today, patient.timezone) },
        },
        orderBy: { startedAt: 'desc' },
      });
      if (visit?.startedAt) {
        fact(
          'ENCOUNTERS',
          `Last completed visit on ${dateOnly(visit.startedAt)}: ${visit.reasonForVisit ?? 'visit'}.`,
          {},
          dateOnly(visit.startedAt),
          { type: 'Encounter', id: visit.id },
        );
      }
    }
    if (can('CONDITIONS')) {
      for (const row of await db.condition.findMany({
        where: { patientProfileId: patient.id, clinicalStatus: 'ACTIVE', recordStatus: 'ACTIVE' },
      })) {
        fact(
          'CONDITIONS',
          `Active condition: ${row.display}${row.code ? ` (${row.code})` : ''}.`,
          {},
          row.onsetDate ? dateOnly(row.onsetDate) : null,
          { type: 'Condition', id: row.id },
        );
      }
    }
    if (can('ALLERGIES')) {
      for (const row of await db.allergy.findMany({
        where: { patientProfileId: patient.id, clinicalStatus: 'ACTIVE', recordStatus: 'ACTIVE' },
      })) {
        fact(
          'ALLERGIES',
          `Allergy: ${row.substance}${row.criticality ? ` (${row.criticality.toLowerCase()} criticality)` : ''}.`,
          {},
          null,
          { type: 'Allergy', id: row.id },
        );
      }
    }
    if (can('MEDICATIONS')) {
      const plans = await db.medicationPlan.findMany({
        where: { patientProfileId: patient.id, status: { in: ['ACTIVE', 'COMPLETED', 'ON_HOLD'] } },
        include: { medication: true },
        orderBy: { startDate: 'asc' },
      });
      for (const plan of plans) {
        const name = `${plan.medication.genericName} ${strength(plan.medication)}`;
        fact(
          'MEDICATIONS',
          `Medication plan: ${name}, status ${plan.status.toLowerCase()}, started ${dateOnly(plan.startDate)}${plan.endDate ? `, ended ${dateOnly(plan.endDate)}` : ''}.`,
          {
            name: plan.medication.genericName,
            strength: strength(plan.medication),
            status: plan.status,
          },
          dateOnly(plan.startDate),
          { type: 'MedicationPlan', id: plan.id },
        );
      }
    }
    if (can('LABS')) {
      const since = addDays(parseIsoDate(today), -200);
      const labs = await db.labResult.findMany({
        where: {
          patientProfileId: patient.id,
          recordStatus: 'ACTIVE',
          // Values read from a report count only after the patient confirms them.
          NOT: { recordSource: 'DOCUMENT_EXTRACTION', verification: 'UNVERIFIED' },
          effectiveAt: { gte: since },
        },
        include: { labTest: true },
        orderBy: { effectiveAt: 'asc' },
      });
      for (const row of labs) {
        const value = num(row.valueNumeric);
        if (value === null) continue;
        const high = num(row.referenceHigh);
        const unitText = row.unit === '%' ? '%' : ` ${row.unit}`;
        fact(
          'LABS',
          `${row.labTest.name} ${value}${unitText} on ${dateOnly(row.effectiveAt)}${high !== null ? ` (reference up to ${high}${unitText})` : ''}.`,
          { testName: row.labTest.name, value, unit: row.unit, referenceHigh: high },
          dateOnly(row.effectiveAt),
          { type: 'LabResult', id: row.id },
        );
      }
    }

    const progress = await this.progress.compute(patient, allowed);
    for (const metric of progress.metrics) {
      if (metric.metric === 'BODY_WEIGHT' && metric.before !== null && metric.after !== null) {
        calc(
          'VITALS',
          `Body weight: ${metric.before} kg at the last visit; ${metric.after} kg most recently.`,
          { metric: 'BODY_WEIGHT_CHANGE', from: metric.before, to: metric.after, unit: 'kg' },
          'weight',
        );
      }
      if (metric.metric === 'AVERAGE_DAILY_STEPS' && metric.after !== null) {
        calc(
          'ACTIVITY',
          `Average daily steps: ${metric.before ?? 'not enough data'} in the 30 days before the last visit; ${metric.after} in the last 30 days.`,
          { metric: 'AVERAGE_DAILY_STEPS', before: metric.before, after: metric.after },
          'steps',
        );
      }
    }
    if (can('ADHERENCE')) {
      const summary = await this.adherence.summary(patient);
      if (summary.percentage !== null) {
        calc(
          'ADHERENCE',
          `Recorded adherence since the last visit: ${summary.percentage}% (${summary.taken} of ${summary.due} doses).`,
          {
            metric: 'RECORDED_ADHERENCE',
            percentage: summary.percentage,
            taken: summary.taken,
            due: summary.due,
          },
          'adherence',
        );
        calc(
          'ADHERENCE',
          `Longest run of consecutive missed doses: ${summary.longestMissedRun}.`,
          { metric: 'LONGEST_MISSED_RUN', length: summary.longestMissedRun },
          'missed-run',
        );
      }
    }
    return { subjectRef: 'patient-1', asOf: today, facts };
  }
}
