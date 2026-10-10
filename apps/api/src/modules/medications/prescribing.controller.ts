import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  checkInstructionPreservation,
  renderDoseInstruction,
  renderNotePhrases,
  type InstructionPlanFields,
} from '@healthguard/clinical';
import {
  addDays,
  DraftPlanRequestSchema,
  parseIsoDate,
  PatientIdParamsSchema,
  PlanParamsSchema,
  SignPlanRequestSchema,
  StopPlanRequestSchema,
  SUPPORTED_LOCALES,
  toIsoDate,
  zonedDayStart,
  type DraftPlanRequest,
  type PatientIdParams,
  type PlanCheck,
  type PlanParams,
  type PlanReview,
  type SignPlanRequest,
  type StopPlanRequest,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { strength } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import type { Medication, PatientProfile } from '../../generated/prisma/client.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { cancelFutureDoses, materializeDoses } from '../doses/dose-engine.js';
import { toInstructionView, toPlanView } from './plan-view.js';

const LIMITATIONS =
  'HealthGuard checks recorded allergies, duplicate active medicines and that every language says the same dose. ' +
  'It is not a drug-interaction or dosing check. The prescriber is responsible for the prescription.';

const STOP_REASON_TEXT: Record<StopPlanRequest['reason'], string> = {
  COURSE_NOT_NEEDED: 'Course no longer needed',
  SIDE_EFFECT_REPORTED: 'Side effect reported',
  CHANGED_TREATMENT: 'Treatment changed',
  ENTERED_IN_ERROR: 'Entered in error',
};

function doseUnitFor(medication: Medication): 'TABLET' | 'CAPSULE' {
  return medication.form === 'CAPSULE' ? 'CAPSULE' : 'TABLET';
}

function instructionFields(
  medication: Medication,
  plan: {
    doseQuantity: number;
    timingEvents: string[];
    timingOffsetMinutes: number | null;
    durationDays: number | null;
  },
): InstructionPlanFields {
  return {
    drugName: medication.genericName,
    strength: strength(medication),
    doseQuantity: plan.doseQuantity,
    doseUnit: doseUnitFor(medication),
    frequency: 1,
    period: 1,
    periodUnit: 'DAY',
    timingEvents: plan.timingEvents,
    timingOffsetMinutes: plan.timingOffsetMinutes,
    durationDays: plan.durationDays,
  };
}

/**
 * Prescribing: a doctor drafts a plan, HealthGuard runs its checks and renders
 * the instruction from reviewed templates in every language, and the
 * prescriber signs. A signed plan never changes; a dose change is a new
 * version. Patients and AI can never sign.
 */
@ApiTags('prescribing')
@Controller({ path: 'patients/:patientId/medication-plans', version: '1' })
export class PrescribingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private async prescriber(actor: ActorContext) {
    if (!actor.clinicianId) throw Problems.forbidden('Only a clinician can prescribe.');
    const clinician = await this.prisma.db.clinicianProfile.findUnique({
      where: { id: actor.clinicianId },
    });
    if (!clinician?.isPrescriber) {
      throw Problems.forbidden('Your profile is not set up as a prescriber.');
    }
    return clinician;
  }

  /** The rule checks for a plan. BLOCK stops signing. */
  private async checks(
    patient: PatientProfile,
    medication: Medication,
    plan: {
      id?: string;
      doseQuantity: number;
      timingEvents: string[];
      timingOffsetMinutes: number | null;
      durationDays: number | null;
      supersedesId: string | null;
    },
  ): Promise<PlanCheck[]> {
    const db = this.prisma.tenant(patient.organizationId);
    const checks: PlanCheck[] = [];
    const allergies = await db.allergy.findMany({
      where: { patientProfileId: patient.id, clinicalStatus: 'ACTIVE', recordStatus: 'ACTIVE' },
    });
    const conflicts = allergies.filter(
      (allergy) =>
        (allergy.allergenClass && medication.allergenClasses.includes(allergy.allergenClass)) ||
        allergy.substance.toLowerCase() === medication.genericName.toLowerCase(),
    );
    checks.push(
      conflicts.length
        ? {
            code: 'ALLERGY_CONFLICT',
            severity: 'BLOCK',
            message: `Recorded allergy: ${conflicts
              .map(
                (allergy) =>
                  `${allergy.substance}${allergy.reaction ? ` (${allergy.reaction})` : ''}`,
              )
              .join(
                ', ',
              )}. ${medication.genericName} belongs to the same allergen class. Signing is blocked.`,
          }
        : {
            code: 'ALLERGY_CONFLICT',
            severity: 'PASS',
            message: allergies.length
              ? `No recorded allergy matches ${medication.genericName}.`
              : 'No allergies are recorded for this patient.',
          },
    );
    const duplicate = await db.medicationPlan.findFirst({
      where: {
        patientProfileId: patient.id,
        medicationId: medication.id,
        status: 'ACTIVE',
        ...(plan.supersedesId ? { id: { not: plan.supersedesId } } : {}),
      },
    });
    checks.push(
      duplicate
        ? {
            code: 'DUPLICATE_ACTIVE',
            severity: 'BLOCK',
            message: `${medication.genericName} is already active. Change the existing plan instead (a new version).`,
          }
        : { code: 'DUPLICATE_ACTIVE', severity: 'PASS', message: 'No duplicate active medicine.' },
    );
    const fields = instructionFields(medication, plan);
    for (const locale of SUPPORTED_LOCALES) {
      const rendered = renderDoseInstruction(fields, locale);
      if (!rendered.ok) {
        checks.push({
          code: 'INSTRUCTION_TEMPLATE',
          severity: 'BLOCK',
          message: `${locale}: ${rendered.reason}.`,
        });
        continue;
      }
      const preservation = checkInstructionPreservation(rendered.text, fields);
      checks.push({
        code: 'PRESERVATION',
        severity: preservation.passed ? 'PASS' : 'BLOCK',
        message: preservation.passed
          ? `${locale}: drug, strength, quantity and duration match the plan.`
          : `${locale}: ${preservation.problems.join('; ')}.`,
      });
    }
    return checks;
  }

  private async review(patient: PatientProfile, planId: string): Promise<PlanReview> {
    const db = this.prisma.tenant(patient.organizationId);
    const plan = await db.medicationPlan.findFirst({
      where: { id: planId, patientProfileId: patient.id },
      include: { medication: true, prescriber: true, instructions: { orderBy: { locale: 'asc' } } },
    });
    if (!plan) throw Problems.notFound('medication plan');
    const current = plan.instructions.filter((row) => row.status !== 'SUPERSEDED');
    const checks =
      plan.status === 'DRAFT'
        ? await this.checks(patient, plan.medication, {
            id: plan.id,
            doseQuantity: Number(plan.doseQuantity),
            timingEvents: plan.timingEvents,
            timingOffsetMinutes: plan.timingOffsetMinutes,
            durationDays: plan.durationDays,
            supersedesId: plan.supersedesId,
          })
        : [];
    const english = current.find((row) => row.locale === 'en-IN') ?? null;
    return {
      plan: toPlanView(plan, english, patient),
      checks,
      instructions: current.map(toInstructionView),
      canSign: plan.status === 'DRAFT' && checks.every((check) => check.severity !== 'BLOCK'),
      limitations: LIMITATIONS,
    };
  }

  @Get('drafts')
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Unsigned drafts for this patient' })
  async drafts(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<PlanReview[]> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
      'CREATE',
    );
    const drafts = await this.prisma.tenant(patient.organizationId).medicationPlan.findMany({
      where: { patientProfileId: patient.id, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return Promise.all(drafts.map((draft) => this.review(patient, draft.id)));
  }

  @Post('drafts')
  @HttpCode(201)
  @Roles('DOCTOR')
  @ApiOperation({
    summary: 'Draft a plan; returns the checks and the instruction in every language',
  })
  async draft(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
    @Body(zod(DraftPlanRequestSchema)) body: DraftPlanRequest,
  ): Promise<PlanReview> {
    const clinician = await this.prescriber(actor);
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
      'CREATE',
    );
    const db = this.prisma.tenant(patient.organizationId);
    const medication = await this.prisma.db.medication.findFirst({
      where: { id: body.medicationId, isActive: true },
    });
    if (!medication) throw Problems.notFound('medicine');
    const offset = body.timingOffsetMinutes || null;
    let supersedes: { id: string; version: number } | null = null;
    if (body.replacesPlanId) {
      supersedes = await db.medicationPlan.findFirst({
        where: { id: body.replacesPlanId, patientProfileId: patient.id, status: 'ACTIVE' },
        select: { id: true, version: true },
      });
      if (!supersedes) throw Problems.conflict('Only an active plan can be replaced.');
      const pending = await db.medicationPlan.count({
        where: { supersedesId: supersedes.id },
      });
      if (pending) throw Problems.conflict('A draft already replaces that plan.');
    }
    const encounter =
      body.encounterId ??
      (
        await db.encounter.findFirst({
          where: { patientProfileId: patient.id, clinicianId: clinician.id, status: 'IN_PROGRESS' },
          orderBy: { startedAt: 'desc' },
          select: { id: true },
        })
      )?.id ??
      null;
    const today = await this.clock.today(patient.timezone);
    const startDate = addDays(parseIsoDate(today), 1);
    const fields = instructionFields(medication, {
      doseQuantity: body.doseQuantity,
      timingEvents: [body.timingEvent],
      timingOffsetMinutes: offset,
      durationDays: body.durationDays,
    });

    const plan = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.medicationPlan.create({
        data: {
          organizationId: patient.organizationId,
          patientProfileId: patient.id,
          encounterId: encounter,
          medicationId: medication.id,
          prescriberId: clinician.id,
          doseQuantity: body.doseQuantity,
          doseUnit: doseUnitFor(medication),
          route: medication.defaultRoute,
          frequency: 1,
          timingEvents: [body.timingEvent],
          timingOffsetMinutes: offset,
          durationDays: body.durationDays,
          startDate,
          endDate: body.durationDays ? addDays(startDate, body.durationDays - 1) : null,
          indication: body.indication,
          specialInstructions: renderNotePhrases(body.notePhrases, 'en-IN'),
          status: 'DRAFT',
          version: (supersedes?.version ?? 0) + 1,
          supersedesId: supersedes?.id ?? null,
          recordSource: 'CLINICIAN_ENTERED',
          verification: 'CLINICIAN_VERIFIED',
          recordedByUserId: actor.userId,
        },
      });
      for (const locale of SUPPORTED_LOCALES) {
        const rendered = renderDoseInstruction(fields, locale);
        const preservation = rendered.ok
          ? checkInstructionPreservation(rendered.text, fields)
          : { passed: false, problems: [rendered.reason] };
        await tx.medicationInstruction.create({
          data: {
            organizationId: patient.organizationId,
            medicationPlanId: created.id,
            locale,
            doseText: rendered.ok ? rendered.text : '',
            notesText: renderNotePhrases(body.notePhrases, locale),
            method: 'TEMPLATE_ONLY',
            templateKey: rendered.ok ? rendered.templateKey : 'none',
            validationStatus: preservation.passed ? 'PASSED' : 'FAILED',
            validationReport: {
              checks: ['template-render', 'preservation'],
              passed: preservation.passed,
              problems: preservation.problems,
              notePhrases: body.notePhrases,
            },
            status: 'DRAFT',
          },
        });
      }
      return created;
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CREATE',
      resourceType: 'MedicationPlan',
      resourceId: plan.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { status: 'DRAFT', version: plan.version, replaces: supersedes?.id ?? null },
    });
    return this.review(patient, plan.id);
  }

  @Get(':planId/review')
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'A plan with its checks and the instruction in every language' })
  async getReview(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PlanParamsSchema)) params: PlanParams,
  ): Promise<PlanReview> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
    );
    return this.review(patient, params.planId);
  }

  @Post(':planId/sign')
  @HttpCode(200)
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'The prescriber signs a draft after reading every language' })
  async sign(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PlanParamsSchema)) params: PlanParams,
    @Body(zod(SignPlanRequestSchema)) _body: SignPlanRequest,
  ): Promise<PlanReview> {
    const clinician = await this.prescriber(actor);
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
      'SIGN',
    );
    const before = await this.review(patient, params.planId);
    if (before.plan.status !== 'DRAFT') throw Problems.conflict('Only a draft can be signed.');
    if (before.plan.prescriber?.id !== clinician.id) {
      throw Problems.forbidden('Only the prescriber named on the draft can sign it.');
    }
    if (!before.canSign) {
      await this.audit.record({
        actor,
        meta,
        organizationId: patient.organizationId,
        action: 'SIGN',
        resourceType: 'MedicationPlan',
        resourceId: params.planId,
        patientProfileId: patient.id,
        decision: 'DENY',
        decisionReason: 'BLOCKING_CHECK',
        outcome: 'FAILURE',
        metadata: {
          blocking: before.checks.filter((check) => check.severity === 'BLOCK').map((c) => c.code),
        },
      });
      throw Problems.conflict('A blocking check failed. Resolve it before signing.');
    }
    const now = await this.clock.now(patient.timezone);
    const tomorrow = zonedDayStart(
      toIsoDate(addDays(parseIsoDate(await this.clock.today(patient.timezone)), 1)),
      patient.timezone,
    );
    await this.prisma.db.$transaction(async (tx) => {
      const draft = await tx.medicationPlan.findFirstOrThrow({
        where: { id: params.planId, organizationId: patient.organizationId },
      });
      const signed = await tx.medicationPlan.updateMany({
        where: { id: draft.id, status: 'DRAFT' },
        data: { status: 'ACTIVE', signedAt: now },
      });
      if (signed.count === 0) throw Problems.conflict('This draft was just changed.');
      await tx.medicationInstruction.updateMany({
        where: { medicationPlanId: draft.id, status: 'DRAFT', validationStatus: 'PASSED' },
        data: { status: 'APPROVED', approvedByUserId: actor.userId, approvedAt: now },
      });
      if (draft.supersedesId) {
        await tx.medicationPlan.update({
          where: { id: draft.supersedesId },
          data: {
            status: 'SUPERSEDED',
            stoppedAt: now,
            stopReason: `Replaced by version ${draft.version}`,
          },
        });
        await tx.medicationInstruction.updateMany({
          where: { medicationPlanId: draft.supersedesId, status: 'APPROVED' },
          data: { status: 'SUPERSEDED' },
        });
        await cancelFutureDoses(tx, draft.supersedesId, tomorrow);
      }
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'SIGN',
      resourceType: 'MedicationPlan',
      resourceId: params.planId,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { version: before.plan.version, instructionsApproved: before.instructions.length },
    });
    await materializeDoses(
      this.prisma.db,
      { demo: await this.clock.demoClock(), real: new Date() },
      { patientId: patient.id },
    );
    return this.review(patient, params.planId);
  }

  @Post(':planId/discard')
  @HttpCode(200)
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Delete an unsigned draft' })
  async discard(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PlanParamsSchema)) params: PlanParams,
  ): Promise<{ id: string; discarded: true }> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
      'CREATE',
    );
    const db = this.prisma.tenant(patient.organizationId);
    const draft = await db.medicationPlan.findFirst({
      where: { id: params.planId, patientProfileId: patient.id, status: 'DRAFT' },
    });
    if (!draft) throw Problems.notFound('draft');
    await this.prisma.db.$transaction([
      this.prisma.db.medicationInstruction.deleteMany({ where: { medicationPlanId: draft.id } }),
      this.prisma.db.medicationPlan.delete({ where: { id: draft.id } }),
    ]);
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'STATUS_CHANGE',
      resourceType: 'MedicationPlan',
      resourceId: draft.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { to: 'DISCARDED_DRAFT' },
    });
    return { id: draft.id, discarded: true };
  }

  @Post(':planId/stop')
  @HttpCode(200)
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Stop an active plan; future doses are cancelled' })
  async stop(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PlanParamsSchema)) params: PlanParams,
    @Body(zod(StopPlanRequestSchema)) body: StopPlanRequest,
  ): Promise<PlanReview> {
    await this.prescriber(actor);
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'MEDICATIONS',
      'MedicationPlan',
      'SIGN',
    );
    const db = this.prisma.tenant(patient.organizationId);
    const plan = await db.medicationPlan.findFirst({
      where: { id: params.planId, patientProfileId: patient.id, status: 'ACTIVE' },
    });
    if (!plan) throw Problems.conflict('Only an active plan can be stopped.');
    const now = await this.clock.now(patient.timezone);
    await this.prisma.db.$transaction(async (tx) => {
      await tx.medicationPlan.update({
        where: { id: plan.id },
        data: {
          status: body.reason === 'ENTERED_IN_ERROR' ? 'ENTERED_IN_ERROR' : 'STOPPED',
          stoppedAt: now,
          stopReason: STOP_REASON_TEXT[body.reason],
        },
      });
      await cancelFutureDoses(tx, plan.id, now);
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'STATUS_CHANGE',
      resourceType: 'MedicationPlan',
      resourceId: plan.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { to: 'STOPPED', reason: body.reason },
    });
    return this.review(patient, plan.id);
  }
}
