import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { addDays, localIsoDate, parseIsoDate, zonedDayStart } from '@healthguard/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DemoClock {
  anchorDay0: string;
  offsetDays: number;
  timezone: string;
}

/**
 * "Now" for clinical calculations. In demo mode the date is pinned to the
 * scenario day (`demo.clock` in SystemSetting) while the time of day is real,
 * so the demo always shows the same story. Outside demo mode it is real time.
 */
@Injectable()
export class ClockService {
  private cached: { value: DemoClock | null; loadedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async demoClock(): Promise<DemoClock | null> {
    if (!this.config.demoMode) return null;
    if (this.cached && Date.now() - this.cached.loadedAt < 30_000) return this.cached.value;
    const row = await this.prisma.db.systemSetting.findUnique({ where: { key: 'demo.clock' } });
    const value = (row?.value as DemoClock | undefined) ?? null;
    this.cached = { value, loadedAt: Date.now() };
    return value;
  }

  async now(timezone = 'Asia/Kolkata'): Promise<Date> {
    const clock = await this.demoClock();
    const real = new Date();
    if (!clock) return real;
    const today = addDays(parseIsoDate(clock.anchorDay0), clock.offsetDays);
    const realDayStart = zonedDayStart(localIsoDate(real, timezone), timezone);
    const timeOfDay = real.getTime() - realDayStart.getTime();
    return new Date(
      zonedDayStart(today.toISOString().slice(0, 10), timezone).getTime() + timeOfDay,
    );
  }

  /** Today's calendar date (`YYYY-MM-DD`) in the time zone. */
  async today(timezone = 'Asia/Kolkata'): Promise<string> {
    return localIsoDate(await this.now(timezone), timezone);
  }

  invalidate(): void {
    this.cached = null;
  }
}

@Global()
@Module({ providers: [ClockService], exports: [ClockService] })
export class ClockModule {}
