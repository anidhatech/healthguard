import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ageInYears,
  PatientIdParamsSchema,
  PatientListQuerySchema,
  resolveLocale,
  type PatientIdParams,
  type PatientListItem,
  type PatientFlag,
  type PatientListQuery,
  type PatientProfileView,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { dateOnly, maskPhone, patientDisplayName } from '../../common/mapping.js';
import { zod } from '../../common/zod.pipe.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AccessService } from '../consent/access.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { MISSED_RUN_FOR_CALLBACK } from '../doses/dose-engine.js';

@ApiTags('patients')
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @Roles('DOCTOR', 'CARE_TEAM', 'FRONT_DESK')
  @ApiOperation({ summary: "The organization's patients (demographics only; tenant-scoped)" })
  async list(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Query(zod(PatientListQuerySchema)) query: PatientListQuery,
  ): Promise<PatientListItem[]> {
    const organizationId = requireOrganization(actor);
    const scoped = this.prisma.tenant(organizationId);
    const search = query.search?.trim();
    const rows = await scoped.patientProfile.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { givenName: { contains: search, mode: 'insensitive' } },
                { familyName: { contains: search, mode: 'insensitive' } },
                { mrn: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { primaryClinician: true },
      orderBy: [{ givenName: 'asc' }],
      take: 100,
    });
    const encounters = actor.clinicianId
      ? await scoped.encounter.findMany({
          where: {
            clinicianId: actor.clinicianId,
            patientProfileId: { in: rows.map((row) => row.id) },
          },
          select: { patientProfileId: true },
          distinct: ['patientProfileId'],
        })
      : [];
    const seen = new Set(encounters.map((row) => row.patientProfileId));
    const flags = await this.flags(
      actor,
      organizationId,
      rows.map((row) => row.id),
    );
    const today = new Date(`${await this.clock.today()}T00:00:00Z`);
    const items = rows.map((row) => ({
      id: row.id,
      displayName: patientDisplayName(row),
      mrn: row.mrn,
      ageYears: ageInYears(row.dateOfBirth, today),
      sex: row.sex,
      preferredLocale: resolveLocale(row.preferredLocale),
      primaryClinician: row.primaryClinician
        ? { id: row.primaryClinician.id, displayName: row.primaryClinician.displayName }
        : null,
      careRelationship:
        Boolean(actor.clinicianId) &&
        (row.primaryClinicianId === actor.clinicianId || seen.has(row.id)),
      isSynthetic: row.isSynthetic,
      flags: flags.get(row.id) ?? [],
    }));
    await this.audit.record({
      actor,
      meta,
      action: 'READ',
      resourceType: 'PatientList',
      decision: 'ALLOW',
      decisionReason: 'DEMOGRAPHICS_ORGANIZATION_SCOPE',
      metadata: { count: items.length, searched: Boolean(search) },
    });
    return query.scope === 'my-care' ? items.filter((item) => item.careRelationship) : items;
  }

  /**
   * Work-list flags, computed only for patients whose adherence and care-plan
   * data the caller is allowed to see.
   */
  private async flags(
    actor: ActorContext,
    organizationId: string,
    patientIds: string[],
  ): Promise<Map<string, PatientFlag[]>> {
    const result = new Map<string, PatientFlag[]>();
    const scoped = this.prisma.tenant(organizationId);
    for (const patientId of patientIds) {
      const [adherence, carePlan, labs, appointments] = await Promise.all([
        this.access.decide(actor, patientId, 'ADHERENCE'),
        this.access.decide(actor, patientId, 'CARE_PLAN'),
        this.access.decide(actor, patientId, 'LABS'),
        this.access.decide(actor, patientId, 'APPOINTMENTS'),
      ]);
      const list: PatientFlag[] = [];
      if (adherence.allowed) {
        const plans = await scoped.medicationPlan.findMany({
          where: { patientProfileId: patientId, status: 'ACTIVE' },
          select: { id: true },
        });
        for (const plan of plans) {
          const recent = await scoped.medicationDoseEvent.findMany({
            where: { medicationPlanId: plan.id, status: { in: ['TAKEN', 'SKIPPED', 'MISSED'] } },
            orderBy: { scheduledAt: 'desc' },
            take: MISSED_RUN_FOR_CALLBACK,
            select: { status: true },
          });
          if (
            recent.length === MISSED_RUN_FOR_CALLBACK &&
            recent.every((dose) => dose.status === 'MISSED')
          ) {
            list.push('MISSED_DOSES');
            break;
          }
        }
      }
      if (carePlan.allowed) {
        const open = await scoped.followUp.count({
          where: {
            patientProfileId: patientId,
            type: 'CALLBACK',
            status: { in: ['PLANNED', 'DUE', 'OVERDUE'] },
          },
        });
        if (open > 0) list.push('CALLBACK_OPEN');
      }
      if (labs.allowed) {
        const unconfirmed = await scoped.labResult.count({
          where: {
            patientProfileId: patientId,
            recordSource: 'DOCUMENT_EXTRACTION',
            verification: 'UNVERIFIED',
          },
        });
        if (unconfirmed > 0) list.push('LAB_TO_CONFIRM');
      }
      if (appointments.allowed) {
        const proposed = await scoped.appointment.count({
          where: { patientProfileId: patientId, status: 'PROPOSED' },
        });
        if (proposed > 0) list.push('APPOINTMENT_AWAITING_PATIENT');
      }
      result.set(patientId, list);
    }
    return result;
  }

  @Get(':patientId')
  @ApiOperation({
    summary: 'One patient profile (demographics; the patient themself or authorized staff)',
  })
  async get(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<PatientProfileView> {
    const { patient } = await this.patientAccess.authorize(
      actor,
      meta,
      params.patientId,
      'DEMOGRAPHICS',
      'PatientProfile',
    );
    const row = await this.prisma.tenant(patient.organizationId).patientProfile.findFirstOrThrow({
      where: { id: patient.id },
      include: { organization: true, primaryClinician: true },
    });
    const today = new Date(`${await this.clock.today(row.timezone)}T00:00:00Z`);
    return {
      id: row.id,
      organization: {
        id: row.organization.id,
        name: row.organization.name,
        slug: row.organization.slug,
        type: row.organization.type,
        isDemo: row.organization.isDemo,
      },
      displayName: patientDisplayName(row),
      givenName: row.givenName,
      familyName: row.familyName,
      mrn: row.mrn,
      dateOfBirth: dateOnly(row.dateOfBirth),
      ageYears: ageInYears(row.dateOfBirth, today),
      sex: row.sex,
      phoneMasked: maskPhone(row.phone),
      preferredLocale: resolveLocale(row.preferredLocale),
      timezone: row.timezone,
      dailyRoutine: (row.dailyRoutine ?? {}) as Record<string, string>,
      primaryClinician: row.primaryClinician
        ? { id: row.primaryClinician.id, displayName: row.primaryClinician.displayName }
        : null,
      status: row.status,
      isSynthetic: row.isSynthetic,
      abhaLinked: Boolean(row.abhaAddress),
    };
  }
}

@Module({ controllers: [PatientsController] })
export class PatientsModule {}
