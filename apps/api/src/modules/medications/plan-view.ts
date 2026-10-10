import { resolveLocale, type MedicationInstructionView, type MedicationPlanView } from '@healthguard/shared';
import {
  dateOnly,
  dateOnlyOrNull,
  isoOrNull,
  num,
  provenance,
  strength,
} from '../../common/mapping.js';
import type {
  ClinicianProfile,
  Medication,
  MedicationInstruction,
  MedicationPlan,
  PatientProfile,
} from '../../generated/prisma/client.js';

export const SYNTHETIC_PLAN_NOTICE =
  'Synthetic demo plan. Real generic medicine used for realism; not a prescription and not medical advice.';

export type PlanRow = MedicationPlan & {
  medication: Medication;
  prescriber: ClinicianProfile | null;
};

export function toInstructionView(instruction: MedicationInstruction): MedicationInstructionView {
  return {
    id: instruction.id,
    locale: resolveLocale(instruction.locale),
    doseText: instruction.doseText,
    notesText: instruction.notesText,
    method: instruction.method,
    templateKey: instruction.templateKey,
    status: instruction.status,
    approvedAt: isoOrNull(instruction.approvedAt),
  };
}

export function toPlanView(
  row: PlanRow,
  instruction: MedicationInstruction | null,
  patient: PatientProfile,
): MedicationPlanView {
  return {
    id: row.id,
    kind: 'FACT',
    provenance: provenance(row),
    medication: {
      id: row.medication.id,
      genericName: row.medication.genericName,
      strength: strength(row.medication),
      form: row.medication.form,
    },
    doseQuantity: num(row.doseQuantity) ?? 0,
    doseUnit: row.doseUnit,
    route: row.route,
    frequency: row.frequency,
    period: row.period,
    periodUnit: row.periodUnit,
    timingEvents: row.timingEvents,
    timingOffsetMinutes: row.timingOffsetMinutes,
    timesOfDay: row.timesOfDay,
    asNeeded: row.asNeeded,
    durationDays: row.durationDays,
    startDate: dateOnly(row.startDate),
    endDate: dateOnlyOrNull(row.endDate),
    indication: row.indication,
    specialInstructions: row.specialInstructions,
    status: row.status,
    version: row.version,
    signedAt: isoOrNull(row.signedAt),
    prescriber: row.prescriber
      ? { id: row.prescriber.id, displayName: row.prescriber.displayName }
      : null,
    instruction: instruction ? toInstructionView(instruction) : null,
    syntheticNotice:
      row.recordSource === 'SYNTHETIC_SEED' || patient.isSynthetic ? SYNTHETIC_PLAN_NOTICE : null,
  };
}

