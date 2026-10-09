import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PatientIdParamsSchema,
  type AllergyView,
  type ConditionView,
  type DataCategory,
  type ImmunizationView,
  type PatientIdParams,
  type ProcedureView,
  type TimelineEvent,
  type TimelineView,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { dateOnly, dateOnlyOrNull, iso, num, provenance, strength } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';

const TIMELINE_CATEGORIES: DataCategory[] = [
  'ENCOUNTERS',
  'CONDITIONS',
  'ALLERGIES',
  'HISTORY',
  'MEDICATIONS',
  'LABS',
  'APPOINTMENTS',
];

@ApiTags('records')
@Controller({ path: 'patients/:patientId', version: '1' })
export class RecordsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('conditions')
  @ApiOperation({ summary: 'Conditions (problem list)' })
  async conditions(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<ConditionView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'CONDITIONS',
      'Condition',
    );
    const rows = await this.prisma.tenant(patient.organizationId).condition.findMany({
      where: { patientProfileId: patient.id, recordStatus: 'ACTIVE' },
      orderBy: [{ clinicalStatus: 'asc' }, { onsetDate: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      display: row.display,
      codeSystem: row.codeSystem,
      code: row.code,
      clinicalStatus: row.clinicalStatus,
      clinicalVerification: row.clinicalVerification,
      onsetDate: dateOnlyOrNull(row.onsetDate),
      abatementDate: dateOnlyOrNull(row.abatementDate),
      note: row.note,
    }));
  }

  @Get('allergies')
  @ApiOperation({ summary: 'Allergies and intolerances' })
  async allergies(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AllergyView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'ALLERGIES',
      'Allergy',
    );
    const rows = await this.prisma.tenant(patient.organizationId).allergy.findMany({
      where: { patientProfileId: patient.id, recordStatus: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      substance: row.substance,
      type: row.type,
      category: row.category,
      criticality: row.criticality,
      reaction: row.reaction,
      severity: row.severity,
      clinicalStatus: row.clinicalStatus,
      clinicalVerification: row.clinicalVerification,
      onsetDate: dateOnlyOrNull(row.onsetDate),
    }));
  }

  @Get('procedures')
  @ApiOperation({ summary: 'Past procedures and surgeries' })
  async procedures(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<ProcedureView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'HISTORY',
      'Procedure',
    );
    const rows = await this.prisma.tenant(patient.organizationId).procedure.findMany({
      where: { patientProfileId: patient.id, recordStatus: 'ACTIVE' },
      orderBy: { performedOn: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      display: row.display,
      code: row.code,
      status: row.status,
      performedOn: dateOnlyOrNull(row.performedOn),
      performerText: row.performerText,
      facilityText: row.facilityText,
      outcome: row.outcome,
    }));
  }

  @Get('immunizations')
  @ApiOperation({ summary: 'Vaccinations' })
  async immunizations(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<ImmunizationView[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'HISTORY',
      'Immunization',
    );
    const rows = await this.prisma.tenant(patient.organizationId).immunization.findMany({
      where: { patientProfileId: patient.id, recordStatus: 'ACTIVE' },
      orderBy: { occurredOn: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: 'FACT',
      provenance: provenance(row),
      vaccineName: row.vaccineName,
      vaccineCode: row.vaccineCode,
      status: row.status,
      occurredOn: dateOnly(row.occurredOn),
      doseNumber: row.doseNumber,
    }));
  }

  @Get('timeline')
  @ApiOperation({ summary: 'One chronological timeline across the categories the caller may see' })
  async timeline(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<TimelineView> {
    const { patient, allowed, hidden } = await this.patientAccess.authorizeCategories(
      actor,
      meta,
      params.patientId,
      TIMELINE_CATEGORIES,
      'Timeline',
    );
    const db = this.prisma.tenant(patient.organizationId);
    const where = { patientProfileId: patient.id };
    const can = (category: DataCategory) => allowed.includes(category);
    const events: TimelineEvent[] = [];
    const push = (event: Omit<TimelineEvent, 'kind'>) => events.push({ kind: 'FACT', ...event });

    if (can('ENCOUNTERS')) {
      for (const row of await db.encounter.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
        include: { clinician: true },
      })) {
        if (!row.startedAt) continue;
        push({
          id: `encounter:${row.id}`,
          date: iso(row.startedAt),
          category: 'ENCOUNTERS',
          eventType: 'VISIT',
          title: row.reasonForVisit ?? 'Visit',
          detail: row.clinician.displayName,
          source: { type: 'Encounter', id: row.id },
        });
      }
    }
    if (can('CONDITIONS')) {
      for (const row of await db.condition.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
      })) {
        if (!row.onsetDate) continue;
        push({
          id: `condition:${row.id}`,
          date: iso(row.onsetDate),
          category: 'CONDITIONS',
          eventType: 'DIAGNOSIS_RECORDED',
          title: row.display,
          detail: row.code ? `${row.codeSystem ?? ''} ${row.code}`.trim() : null,
          source: { type: 'Condition', id: row.id },
        });
      }
    }
    if (can('ALLERGIES')) {
      for (const row of await db.allergy.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
      })) {
        push({
          id: `allergy:${row.id}`,
          date: iso(row.onsetDate ?? row.createdAt),
          category: 'ALLERGIES',
          eventType: 'ALLERGY_RECORDED',
          title: `Allergy: ${row.substance}`,
          detail: row.reaction,
          source: { type: 'Allergy', id: row.id },
        });
      }
    }
    if (can('HISTORY')) {
      for (const row of await db.procedure.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
      })) {
        if (!row.performedOn) continue;
        push({
          id: `procedure:${row.id}`,
          date: iso(row.performedOn),
          category: 'HISTORY',
          eventType: 'PROCEDURE',
          title: row.display,
          detail: row.facilityText,
          source: { type: 'Procedure', id: row.id },
        });
      }
      for (const row of await db.immunization.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
      })) {
        push({
          id: `immunization:${row.id}`,
          date: iso(row.occurredOn),
          category: 'HISTORY',
          eventType: 'IMMUNIZATION',
          title: row.vaccineName,
          detail: row.doseNumber ? `Dose ${row.doseNumber}` : null,
          source: { type: 'Immunization', id: row.id },
        });
      }
    }
    if (can('MEDICATIONS')) {
      for (const row of await db.medicationPlan.findMany({
        where: { ...where, status: { not: 'DRAFT' } },
        include: { medication: true },
      })) {
        push({
          id: `plan-start:${row.id}`,
          date: iso(row.startDate),
          category: 'MEDICATIONS',
          eventType: 'MEDICATION_STARTED',
          title: `${row.medication.genericName} ${strength(row.medication)} started`,
          detail: row.indication,
          source: { type: 'MedicationPlan', id: row.id },
        });
        if (row.endDate && row.status === 'COMPLETED') {
          push({
            id: `plan-end:${row.id}`,
            date: iso(row.endDate),
            category: 'MEDICATIONS',
            eventType: 'MEDICATION_COURSE_COMPLETED',
            title: `${row.medication.genericName} ${strength(row.medication)} course completed`,
            detail: null,
            source: { type: 'MedicationPlan', id: row.id },
          });
        }
      }
    }
    if (can('LABS')) {
      for (const row of await db.labResult.findMany({
        where: { ...where, recordStatus: 'ACTIVE' },
        include: { labTest: true },
      })) {
        const value = num(row.valueNumeric);
        push({
          id: `lab:${row.id}`,
          date: iso(row.effectiveAt),
          category: 'LABS',
          eventType: 'LAB_RESULT',
          title: `${row.labTest.name}: ${value ?? row.valueText ?? ''} ${row.unit}`.trim(),
          detail:
            row.interpretation === 'HIGH' || row.interpretation === 'LOW'
              ? `Outside reference range (${row.interpretation.toLowerCase()})`
              : null,
          source: { type: 'LabResult', id: row.id },
        });
      }
    }
    if (can('APPOINTMENTS')) {
      for (const row of await db.appointment.findMany({
        where: { ...where, status: { in: ['CONFIRMED', 'PATIENT_APPROVED', 'PROPOSED'] } },
        include: { clinician: true },
      })) {
        push({
          id: `appointment:${row.id}`,
          date: iso(row.startAt),
          category: 'APPOINTMENTS',
          eventType: 'APPOINTMENT_UPCOMING',
          title: row.reason ?? 'Appointment',
          detail: row.clinician.displayName,
          source: { type: 'Appointment', id: row.id },
        });
      }
    }
    events.sort((a, b) => b.date.localeCompare(a.date));
    return { events, hiddenCategories: hidden };
  }
}

@Module({ controllers: [RecordsController] })
export class RecordsModule {}
