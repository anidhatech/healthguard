import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ageInYears,
  PatientIdParamsSchema,
  PatientListQuerySchema,
  resolveLocale,
  type PatientIdParams,
  type PatientListItem,
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
import { PatientAccessService } from '../consent/patient-access.service.js';

@ApiTags('patients')
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
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
