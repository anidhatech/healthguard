import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CounterParamsSchema,
  CreateCounterSchema,
  QueueEntryParamsSchema,
  type CounterList,
  type CounterParams,
  type CounterView,
  type CreateCounter,
  type QueueEntryParams,
  type QueueEntryView,
} from '@healthguard/shared';
import { randomUUID } from 'node:crypto';
import {
  CurrentActor,
  CurrentMeta,
  requireOrganization,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Public, Roles } from '../../common/decorators.js';
import { patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ShareService } from './share.service.js';

/** Counters, their QR codes and today's queue, for the front desk. */
@Injectable()
export class CounterService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly share: ShareService,
  ) {}

  private async clinic(actor: ActorContext) {
    const organization = await this.prisma.db.organization.findFirst({
      where: { id: requireOrganization(actor), deletedAt: null },
    });
    if (!organization) throw Problems.notFound('organization');
    if (organization.isDemo) {
      throw Problems.forbidden('Counters are not available in a demo organization.');
    }
    return organization;
  }

  private qrUrl(facilityId: string | null, code: string): string | null {
    if (!facilityId) return null;
    const base = this.config.env.ABDM_PHR_URL.replace(/\/+$/, '');
    return `${base}/share-profile?hip-id=${encodeURIComponent(facilityId)}&counter-id=${encodeURIComponent(code)}`;
  }

  async list(actor: ActorContext): Promise<CounterList> {
    const organization = await this.clinic(actor);
    const db = this.prisma.tenant(organization.id);
    const counters = await db.counter.findMany({ orderBy: { code: 'asc' } });
    const waiting = await db.queueEntry.groupBy({
      by: ['counterId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    });
    const count = new Map(waiting.map((row) => [row.counterId, row._count._all]));
    return {
      facilityId: organization.hfrId,
      sharingOn: this.share.enabled,
      counters: counters.map((row): CounterView => ({
        id: row.id,
        code: row.code,
        name: row.name,
        active: row.active,
        qrUrl: this.qrUrl(organization.hfrId, row.code),
        waiting: count.get(row.id) ?? 0,
      })),
    };
  }

  async create(actor: ActorContext, meta: RequestMeta, input: CreateCounter): Promise<CounterView> {
    const organization = await this.clinic(actor);
    // ABDM's rule: the counter id is never the facility id or its name.
    if (input.code.toLowerCase() === (organization.hfrId ?? '').toLowerCase()) {
      throw Problems.validation([
        { path: 'code', message: 'The counter id cannot be the facility id.' },
      ]);
    }
    const db = this.prisma.tenant(organization.id);
    const taken = await db.counter.findFirst({
      where: { code: { equals: input.code, mode: 'insensitive' } },
    });
    if (taken) throw Problems.conflict('A counter with this id already exists.');
    const row = await db.counter.create({
      data: { organizationId: organization.id, code: input.code, name: input.name },
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: organization.id,
      action: 'CREATE',
      resourceType: 'Counter',
      resourceId: row.id,
      decision: 'ALLOW',
    });
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      active: row.active,
      qrUrl: this.qrUrl(organization.hfrId, row.code),
      waiting: 0,
    };
  }

  /** Who is waiting at a counter now, in token order. */
  async queue(actor: ActorContext, counterId: string): Promise<QueueEntryView[]> {
    const organization = await this.clinic(actor);
    const db = this.prisma.tenant(organization.id);
    const counter = await db.counter.findFirst({ where: { id: counterId } });
    if (!counter) throw Problems.notFound('counter');
    const entries = await db.queueEntry.findMany({
      where: { counterId, status: 'ACTIVE' },
      orderBy: [{ serviceDate: 'asc' }, { tokenNumber: 'asc' }],
      include: { patient: true },
    });
    return entries.map((row) => ({
      id: row.id,
      tokenNumber: row.tokenNumber,
      status: row.status,
      replyStatus: row.replyStatus,
      arrivedAt: row.createdAt.toISOString(),
      patient: {
        id: row.patient.id,
        mrn: row.patient.mrn,
        displayName: patientDisplayName(row.patient),
      },
    }));
  }

  /** The patient has been seen at the counter: the entry leaves the queue. */
  async close(actor: ActorContext, meta: RequestMeta, entryId: string): Promise<void> {
    const organization = await this.clinic(actor);
    const db = this.prisma.tenant(organization.id);
    const entry = await db.queueEntry.findFirst({ where: { id: entryId } });
    if (!entry) throw Problems.notFound('queue entry');
    if (entry.status === 'CLOSED') return;
    await db.queueEntry.update({
      where: { id: entry.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await this.audit.record({
      actor,
      meta,
      organizationId: organization.id,
      action: 'UPDATE',
      resourceType: 'QueueEntry',
      resourceId: entry.id,
      patientProfileId: entry.patientProfileId,
      decision: 'ALLOW',
      metadata: { status: 'CLOSED' },
    });
  }
}

@ApiTags('counters')
@Roles('FRONT_DESK', 'CARE_TEAM')
@Controller({ path: 'counters', version: '1' })
export class CountersController {
  constructor(private readonly counters: CounterService) {}

  @Get()
  @ApiOperation({ summary: 'Counters, their QR codes and how many are waiting' })
  list(@CurrentActor() actor: ActorContext): Promise<CounterList> {
    return this.counters.list(actor);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a counter' })
  create(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(CreateCounterSchema)) body: CreateCounter,
  ): Promise<CounterView> {
    return this.counters.create(actor, meta, body);
  }

  @Get(':counterId/queue')
  @ApiOperation({ summary: 'Patients waiting at a counter' })
  queue(
    @CurrentActor() actor: ActorContext,
    @Param(zod(CounterParamsSchema)) params: CounterParams,
  ): Promise<QueueEntryView[]> {
    return this.counters.queue(actor, params.counterId);
  }

  @Post('queue/:entryId/close')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark a waiting patient as seen' })
  close(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(QueueEntryParamsSchema)) params: QueueEntryParams,
  ): Promise<void> {
    return this.counters.close(actor, meta, params.entryId);
  }
}

/**
 * Where ABDM posts a profile shared at a counter: `/api/v3/hip/patient/share`.
 * It is answered at once and the work follows, as ABDM asks. No session
 * exists on this call, so it is refused entirely unless sharing is switched on.
 */
@ApiExcludeController()
@Controller({ path: 'hip/patient', version: '3' })
export class PatientShareController {
  private readonly logger = new Logger(PatientShareController.name);

  constructor(private readonly share: ShareService) {}

  @Public()
  @Post('share')
  @HttpCode(200)
  receive(
    @Headers('request-id') requestId: string | undefined,
    @Body() body: unknown,
  ): Record<string, never> {
    if (!this.share.enabled) throw Problems.notFound('route');
    void this.share
      .process(requestId?.trim() || randomUUID(), body)
      .then((outcome) => this.logger.log({ outcome: outcome.status }, 'patient share handled'))
      .catch((error: unknown) =>
        this.logger.error(
          { err: error instanceof Error ? error.message : 'unknown' },
          'patient share failed',
        ),
      );
    return {};
  }
}

@Module({
  imports: [PatientsModule],
  controllers: [CountersController, PatientShareController],
  providers: [ShareService, CounterService],
  exports: [ShareService],
})
export class CountersModule {}
