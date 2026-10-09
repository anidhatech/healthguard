import { Injectable } from '@nestjs/common';
import {
  ADHERENCE_FORMULA,
  calculateAdherence,
  longestMissedRunStart,
} from '@healthguard/clinical';
import { zonedDayStart, type AdherenceSummary } from '@healthguard/shared';
import type { PatientProfile } from '../../generated/prisma/client.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { dateOnly, strength } from '../../common/mapping.js';

/** Recorded adherence: a deterministic calculation over dose events, never a model output. */
@Injectable()
export class AdherenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** The last completed visit's date, which starts the default window. */
  async lastVisitDate(patient: PatientProfile, beforeDate: string): Promise<string | null> {
    const encounter = await this.prisma.tenant(patient.organizationId).encounter.findFirst({
      where: {
        patientProfileId: patient.id,
        status: 'COMPLETED',
        startedAt: { lt: zonedDayStart(beforeDate, patient.timezone) },
      },
      orderBy: { startedAt: 'desc' },
    });
    return encounter?.startedAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: patient.timezone }).format(encounter.startedAt)
      : null;
  }

  async summary(
    patient: PatientProfile,
    since?: string,
  ): Promise<AdherenceSummary & { longestMissedRunStart: string | null }> {
    const today = await this.clock.today(patient.timezone);
    const from = since ?? (await this.lastVisitDate(patient, today)) ?? today;
    const window = {
      from: zonedDayStart(from, patient.timezone),
      to: zonedDayStart(today, patient.timezone),
    };
    const doses = await this.prisma.tenant(patient.organizationId).medicationDoseEvent.findMany({
      where: { patientProfileId: patient.id, scheduledAt: { gte: window.from, lt: window.to } },
      include: { plan: { include: { medication: true } } },
    });
    const records = doses.map((dose) => ({
      planId: dose.medicationPlanId,
      scheduledAt: dose.scheduledAt,
      status: dose.status,
    }));
    const result = calculateAdherence(records, window);
    const runStart =
      result.longestMissedRun >= 2
        ? longestMissedRunStart(
            records.filter(
              (dose) =>
                dose.status === 'MISSED' || dose.status === 'TAKEN' || dose.status === 'SKIPPED',
            ),
          )
        : null;
    const planNames = new Map(
      doses.map((dose) => [
        dose.medicationPlanId,
        `${dose.plan.medication.genericName} ${strength(dose.plan.medication)}`,
      ]),
    );
    return {
      kind: 'CALCULATED',
      label: since
        ? `Recorded adherence since ${since}`
        : 'Recorded adherence since the last visit',
      from,
      to: today,
      taken: result.taken,
      skipped: result.skipped,
      missed: result.missed,
      due: result.due,
      pending: result.pending,
      percentage: result.percentage,
      longestMissedRun: result.longestMissedRun,
      longestMissedRunStart: runStart ? dateOnly(runStart) : null,
      perPlan: [...result.perPlan.entries()].map(([planId, counts]) => ({
        planId,
        medication: planNames.get(planId) ?? 'Medication',
        taken: counts.taken,
        due: counts.due,
        percentage: counts.percentage,
      })),
      formula: ADHERENCE_FORMULA,
      sources: [
        {
          type: 'MedicationDoseEvent',
          id: null,
          label: `${doses.length} dose events`,
          locator: { from, to: today },
        },
      ],
    };
  }
}
