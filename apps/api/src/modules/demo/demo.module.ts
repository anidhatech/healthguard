import { Body, Controller, Get, HttpCode, Inject, Module, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { hash } from '@node-rs/argon2';
import {
  DEMO_DATA_NOTICE,
  DemoAiProviderSchema,
  DemoClockChangeSchema,
  DemoResetSchema,
  type DemoAiProvider,
  type DemoClockChange,
  type DemoConsole,
  type DemoReset,
  type DemoState,
} from '@healthguard/shared';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { Public, Roles } from '../../common/decorators.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { ClockService, type DemoClock } from '../../infrastructure/clock/clock.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { runDoseEngine } from '../doses/dose-engine.js';
import { seedDemoData } from './seed/run.js';

const CHECKPOINTS: DemoConsole['checkpoints'] = [
  {
    day: 0,
    title: 'Day 0 — the visit',
    description: 'Dr. Meera sees Ananya and prescribes Metformin (do it live).',
  },
  {
    day: 6,
    title: 'Day 6 — first week',
    description: 'Reminders in Telugu, a snooze, and "Need help" reaching the care team.',
  },
  {
    day: 42,
    title: 'Day 42 — missed doses',
    description: 'Two missed doses in a row raised a call-back for Ravi.',
  },
  {
    day: 85,
    title: 'Day 85 — new report',
    description: 'A lab report was uploaded; Ananya confirms the values read from it.',
  },
  {
    day: 88,
    title: 'Day 88 — booking',
    description: 'The clinic proposed the day-92 visit; Ananya approves, Ravi confirms.',
  },
  {
    day: 92,
    title: 'Day 92 — follow-up visit',
    description: 'Dr. Meera reviews progress and the AI brief with sources.',
  },
];

/**
 * Demo state (public) and the presenter console (admins, demo mode only):
 * jump to a story checkpoint, move the time of day, switch the AI provider.
 */
@ApiTags('demo')
@Controller({ path: 'demo', version: '1' })
export class DemoController {
  constructor(
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('state')
  @ApiOperation({ summary: 'Demo mode, data notice and the scenario clock' })
  async state(): Promise<DemoState> {
    const clock = await this.clock.demoClock();
    const timezone = clock?.timezone ?? 'Asia/Kolkata';
    return {
      demoMode: this.config.demoMode,
      dataNotice: DEMO_DATA_NOTICE,
      clock: {
        anchorDay0: clock?.anchorDay0 ?? (await this.clock.today(timezone)),
        offsetDays: clock?.offsetDays ?? 0,
        today: await this.clock.today(timezone),
        now: (await this.clock.now(timezone)).toISOString(),
        timezone,
      },
    };
  }

  private requireDemo(): void {
    if (!this.config.demoMode)
      throw Problems.forbidden('The demo console only exists in demo mode.');
  }

  private async aiProvider(): Promise<'DEMO' | 'ANTHROPIC'> {
    const row = await this.prisma.db.systemSetting.findUnique({ where: { key: 'ai.provider' } });
    return (
      (row?.value as { provider?: 'DEMO' | 'ANTHROPIC' } | null)?.provider ?? this.config.aiProvider
    );
  }

  @Get('console')
  @Roles('ORG_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Presenter console: checkpoints, clock and AI provider' })
  async console(): Promise<DemoConsole> {
    this.requireDemo();
    const clock = await this.clock.demoClock();
    return {
      checkpoints: CHECKPOINTS,
      currentDay: clock?.offsetDays ?? 0,
      timeOfDay: clock?.timeOfDay?.clock ?? null,
      ai: {
        provider: await this.aiProvider(),
        claudeAvailable: Boolean(this.config.env.ANTHROPIC_API_KEY),
      },
    };
  }

  @Post('reset')
  @HttpCode(200)
  @Roles('ORG_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({
    summary: 'Reset all demo data to a story checkpoint. Everyone is signed out.',
  })
  async reset(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(DemoResetSchema)) body: DemoReset,
  ): Promise<{ checkpointDay: number; signedOut: true }> {
    this.requireDemo();
    const provider = await this.prisma.db.systemSetting.findUnique({
      where: { key: 'ai.provider' },
    });
    await seedDemoData(this.prisma.db, {
      passwordHash: await hash(this.config.env.DEMO_ACCOUNT_PASSWORD),
      checkpointDay: body.checkpointDay,
    });
    if (provider) {
      await this.prisma.db.systemSetting.create({
        data: { key: 'ai.provider', value: provider.value ?? {} },
      });
    }
    this.clock.invalidate();
    this.sessions.forgetAll();
    // The seed wiped users and sessions; record who asked, by role only.
    await this.audit.record({
      actor: null,
      meta,
      action: 'DEMO_RESET',
      resourceType: 'Database',
      decision: 'NOT_APPLICABLE',
      metadata: { checkpointDay: body.checkpointDay, requestedByRoles: actor.roles },
    });
    return { checkpointDay: body.checkpointDay, signedOut: true };
  }

  @Post('clock')
  @HttpCode(200)
  @Roles('ORG_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Jump to a time of day on the current demo day (or back to real time)' })
  async setClock(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(DemoClockChangeSchema)) body: DemoClockChange,
  ): Promise<DemoState> {
    this.requireDemo();
    const row = await this.prisma.db.systemSetting.findUnique({ where: { key: 'demo.clock' } });
    if (!row) throw Problems.conflict('Seed the demo data first.');
    const value: DemoClock = {
      ...(row.value as unknown as DemoClock),
      timeOfDay: body.timeOfDay
        ? { clock: body.timeOfDay, realAt: new Date().toISOString() }
        : null,
    };
    await this.prisma.db.systemSetting.update({
      where: { key: 'demo.clock' },
      data: { value: { ...value } },
    });
    this.clock.invalidate();
    await this.audit.record({
      actor,
      meta,
      action: 'DEMO_CLOCK_CHANGE',
      resourceType: 'SystemSetting',
      decision: 'NOT_APPLICABLE',
      metadata: { timeOfDay: body.timeOfDay },
    });
    // Reminders and missed doses follow the new time at once (the worker also runs every minute).
    await runDoseEngine(this.prisma.db, { demo: value, real: new Date() });
    return this.state();
  }

  @Post('ai-provider')
  @HttpCode(200)
  @Roles('ORG_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Switch between the demo AI and Claude (only if a key is configured)' })
  async setAiProvider(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(DemoAiProviderSchema)) body: DemoAiProvider,
  ): Promise<DemoConsole> {
    this.requireDemo();
    if (body.provider === 'ANTHROPIC' && !this.config.env.ANTHROPIC_API_KEY) {
      throw Problems.conflict('No Claude API key is configured on the server (ANTHROPIC_API_KEY).');
    }
    await this.prisma.db.systemSetting.upsert({
      where: { key: 'ai.provider' },
      create: { key: 'ai.provider', value: { provider: body.provider } },
      update: { value: { provider: body.provider } },
    });
    await this.audit.record({
      actor,
      meta,
      action: 'UPDATE',
      resourceType: 'SystemSetting',
      decision: 'NOT_APPLICABLE',
      metadata: { setting: 'ai.provider', provider: body.provider },
    });
    return this.console();
  }
}

@Module({ controllers: [DemoController] })
export class DemoModule {}
