import { randomUUID } from 'node:crypto';
import { Controller, Get, HttpCode, Inject, Module, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
  DATA_CATEGORIES,
  localIsoDate,
  parseIsoDate,
  PatientIdParamsSchema,
  SIMULATED_ABDM_LABEL,
  toIsoDate,
  zonedDayStart,
  type AbdmSimulationView,
  type DeviceSyncResult,
  type InteropStatus,
  type PatientIdParams,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientAccessService } from '../consent/patient-access.service.js';
import { buildPatientBundle, type FhirBundle } from './fhir-export.js';

const ABDM_NOTICE =
  'This is a simulation of how a health-information link could work. HealthGuard is not connected to ABDM, ' +
  'is not ABDM certified, and does not create, read or verify any ABHA number. Nothing leaves HealthGuard.';

const DEVICE_LABEL = 'Synthetic wearable (simulated device; demo data)';

/** Small deterministic generator, so a day's synthetic steps are stable across syncs. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

interface SimulatedLink {
  linkedAt: string;
  address: string;
}

/**
 * Interoperability. FHIR R4 export works (rows the caller may see, tagged
 * SYNTHETIC). ABDM is a clearly labelled simulation only: no network calls, no
 * ABHA data. Device sync uses a synthetic adapter that writes demo step counts.
 */
@ApiTags('interoperability')
@Controller({ version: '1' })
export class InteroperabilityController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private get abdmSimulationEnabled(): boolean {
    return this.config.demoMode || this.config.env.ABDM_ADAPTER === 'sandbox-mock';
  }

  @Get('interoperability/status')
  @ApiOperation({ summary: 'What interoperability exists today' })
  status(): InteropStatus {
    return {
      fhirExport: {
        status: 'AVAILABLE',
        note: 'FHIR R4 Bundle export of the records you may see (docs/FHIR_MAPPING.md). Not validated against the ABDM implementation guide.',
      },
      abdm: {
        adapter: this.abdmSimulationEnabled ? 'simulated' : 'disabled',
        status: this.abdmSimulationEnabled ? 'SIMULATED' : 'NOT_CONNECTED',
        note: `${SIMULATED_ABDM_LABEL}. HealthGuard is not ABDM certified.`,
      },
      devices: {
        adapter: 'synthetic-wearable',
        status: 'SIMULATED',
        note: 'Device sync uses a synthetic adapter that writes demo step counts. No real device is connected.',
      },
    };
  }

  private async exportBundle(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    channel: 'FHIR_EXPORT' | 'ABDM_SIMULATED',
  ): Promise<{ bundle: FhirBundle; hidden: string[] }> {
    const { patient, allowed, hidden } = await this.patientAccess.authorizeCategories(
      actor,
      meta,
      patientId,
      DATA_CATEGORIES,
      'FhirBundle',
    );
    if (allowed.filter((category) => category !== 'DEMOGRAPHICS').length === 0) {
      throw Problems.accessDenied('NO_ACTIVE_CONSENT', 'No clinical records can be shared.');
    }
    const bundle = await buildPatientBundle(
      this.prisma.db,
      patient.id,
      allowed,
      randomUUID(),
      new Date(),
    );
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'EXPORT',
      resourceType: 'FhirBundle',
      resourceId: bundle.id,
      patientProfileId: patient.id,
      decision: 'ALLOW',
      metadata: { channel, resources: bundle.entry.length, categories: allowed, hidden },
    });
    return { bundle, hidden };
  }

  @Get('patients/:patientId/fhir/export')
  @Roles('PATIENT', 'DOCTOR')
  @ApiOperation({
    summary: 'FHIR R4 Bundle (collection) of the records the caller may see; tagged SYNTHETIC',
  })
  async fhirExport(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<FhirBundle> {
    return (await this.exportBundle(actor, meta, params.patientId, 'FHIR_EXPORT')).bundle;
  }

  // -- ABDM simulation (patient only) --------------------------------------

  private linkKey(patientId: string): string {
    return `abdm.simulated-link:${patientId}`;
  }

  private async simulationView(patientId: string): Promise<AbdmSimulationView> {
    const setting = await this.prisma.db.systemSetting.findUnique({
      where: { key: this.linkKey(patientId) },
    });
    const link = (setting?.value as SimulatedLink | undefined) ?? null;
    const patient = await this.prisma.db.patientProfile.findUniqueOrThrow({
      where: { id: patientId },
    });
    const encounters = await this.prisma.tenant(patient.organizationId).encounter.findMany({
      where: { patientProfileId: patientId, status: 'COMPLETED', recordStatus: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return {
      label: SIMULATED_ABDM_LABEL,
      linked: Boolean(link),
      linkedAt: link?.linkedAt ?? null,
      simulatedAddress: link?.address ?? null,
      careContexts: encounters.map((row) => ({
        id: row.id,
        display: `Visit: ${row.reasonForVisit ?? 'consultation'}`,
        date: row.startedAt ? toIsoDate(row.startedAt) : null,
      })),
      notice: ABDM_NOTICE,
    };
  }

  private async requireSimulation(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
  ): Promise<void> {
    if (!this.abdmSimulationEnabled) {
      throw Problems.serviceUnavailable('The ABDM simulation is turned off here.');
    }
    await this.patientAccess.requireSelf(actor, meta, patientId, 'AbdmSimulatedLink');
  }

  @Get('patients/:patientId/abdm-simulation')
  @ApiOperation({ summary: `${SIMULATED_ABDM_LABEL}: link status and care contexts` })
  async simulation(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AbdmSimulationView> {
    await this.requireSimulation(actor, meta, params.patientId);
    return this.simulationView(params.patientId);
  }

  @Post('patients/:patientId/abdm-simulation/link')
  @HttpCode(200)
  @ApiOperation({ summary: `${SIMULATED_ABDM_LABEL}: link care contexts (writes no ABHA data)` })
  async link(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AbdmSimulationView> {
    await this.requireSimulation(actor, meta, params.patientId);
    const patient = await this.prisma.db.patientProfile.findUniqueOrThrow({
      where: { id: params.patientId },
    });
    const value: SimulatedLink = {
      linkedAt: (await this.clock.now(patient.timezone)).toISOString(),
      address: `${patient.givenName.toLowerCase().replace(/[^a-z]/g, '')}.demo@simulated`,
    };
    await this.prisma.db.systemSetting.upsert({
      where: { key: this.linkKey(patient.id) },
      create: { key: this.linkKey(patient.id), value: { ...value } },
      update: { value: { ...value } },
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CREATE',
      resourceType: 'AbdmSimulatedLink',
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: { channel: 'ABDM_SIMULATED', simulated: true },
    });
    return this.simulationView(patient.id);
  }

  @Post('patients/:patientId/abdm-simulation/unlink')
  @HttpCode(200)
  @ApiOperation({ summary: `${SIMULATED_ABDM_LABEL}: remove the simulated link` })
  async unlink(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<AbdmSimulationView> {
    await this.requireSimulation(actor, meta, params.patientId);
    await this.prisma.db.systemSetting.deleteMany({
      where: { key: this.linkKey(params.patientId) },
    });
    await this.audit.record({
      actor,
      meta,
      action: 'STATUS_CHANGE',
      resourceType: 'AbdmSimulatedLink',
      patientProfileId: params.patientId,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: { channel: 'ABDM_SIMULATED', to: 'UNLINKED' },
    });
    return this.simulationView(params.patientId);
  }

  @Get('patients/:patientId/abdm-simulation/share-preview')
  @ApiOperation({
    summary: `${SIMULATED_ABDM_LABEL}: the FHIR Bundle that would be shared. Nothing is sent.`,
  })
  async sharePreview(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<{ label: string; notice: string; sent: false; bundle: FhirBundle }> {
    await this.requireSimulation(actor, meta, params.patientId);
    const view = await this.simulationView(params.patientId);
    if (!view.linked) throw Problems.conflict('Link the simulated account first.');
    const { bundle } = await this.exportBundle(actor, meta, params.patientId, 'ABDM_SIMULATED');
    return { label: SIMULATED_ABDM_LABEL, notice: ABDM_NOTICE, sent: false, bundle };
  }

  // -- Synthetic device ----------------------------------------------------

  @Post('patients/:patientId/devices/sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sync the synthetic wearable: fills missing days and today so far' })
  async deviceSync(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(PatientIdParamsSchema)) params: PatientIdParams,
  ): Promise<DeviceSyncResult> {
    await this.patientAccess.requireSelf(actor, meta, params.patientId, 'ActivityMetric');
    const patient = await this.prisma.db.patientProfile.findUniqueOrThrow({
      where: { id: params.patientId },
    });
    const db = this.prisma.tenant(patient.organizationId);
    const now = await this.clock.now(patient.timezone);
    const today = localIsoDate(now, patient.timezone);
    const existing = await db.activityMetric.findMany({
      where: {
        patientProfileId: patient.id,
        type: 'STEPS',
        date: { gte: addDays(parseIsoDate(today), -14) },
      },
      select: { date: true },
    });
    const have = new Set(existing.map((row) => toIsoDate(row.date)));
    const steps = (date: string) => {
      const random = seededRandom(Number(date.replaceAll('-', '')) + patient.id.charCodeAt(0));
      return Math.round(5200 + random() * 2600);
    };
    let daysAdded = 0;
    for (let offset = 14; offset >= 1; offset -= 1) {
      const date = toIsoDate(addDays(parseIsoDate(today), -offset));
      if (have.has(date)) continue;
      await db.activityMetric.create({
        data: {
          organizationId: patient.organizationId,
          patientProfileId: patient.id,
          type: 'STEPS',
          date: parseIsoDate(date),
          value: steps(date),
          unit: 'steps',
          recordSource: 'DEVICE',
          sourceSystem: 'synthetic-wearable',
        },
      });
      daysAdded += 1;
    }
    const dayFraction =
      (now.getTime() - zonedDayStart(today, patient.timezone).getTime()) / 86_400_000;
    const todaySteps = Math.max(0, Math.round(steps(today) * Math.min(1, dayFraction)));
    await this.prisma.db.activityMetric.upsert({
      where: {
        patientProfileId_type_date_sourceSystem: {
          patientProfileId: patient.id,
          type: 'STEPS',
          date: parseIsoDate(today),
          sourceSystem: 'synthetic-wearable',
        },
      },
      create: {
        organizationId: patient.organizationId,
        patientProfileId: patient.id,
        type: 'STEPS',
        date: parseIsoDate(today),
        value: todaySteps,
        unit: 'steps',
        recordSource: 'DEVICE',
        sourceSystem: 'synthetic-wearable',
      },
      update: { value: todaySteps },
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: patient.organizationId,
      action: 'CREATE',
      resourceType: 'ActivityMetric',
      patientProfileId: patient.id,
      decision: 'ALLOW',
      decisionReason: 'SELF',
      metadata: { adapter: 'synthetic-wearable', daysAdded },
    });
    return {
      adapter: 'synthetic-wearable',
      label: DEVICE_LABEL,
      daysAdded,
      todaySteps,
      syncedAt: now.toISOString(),
    };
  }
}

@Module({ controllers: [InteroperabilityController] })
export class InteroperabilityModule {}
