import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DEMO_DATA_NOTICE, type DemoState } from '@healthguard/shared';
import { Public } from '../../common/decorators.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { ClockService } from '../../infrastructure/clock/clock.service.js';

@ApiTags('demo')
@Controller({ path: 'demo', version: '1' })
export class DemoController {
  constructor(
    private readonly clock: ClockService,
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
}

@Module({ controllers: [DemoController] })
export class DemoModule {}
