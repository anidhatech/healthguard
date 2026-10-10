import { Global, Inject, Injectable, Module } from '@nestjs/common';
import {
  addDays,
  localIsoDate,
  parseIsoDate,
  toIsoDate,
  zonedDateTime,
  zonedDayStart,
} from '@healthguard/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DemoClock {
  anchorDay0: string;
  offsetDays: number;
  timezone: string;
  /**
   * Optional time-of-day jump for demonstrations: at real instant `realAt`
   * the demo clock read `clock` (HH:MM), and it runs on from there.
   */
  timeOfDay?: { clock: string; realAt: string } | null;
}

/** The demo "now": the scenario day with the real time of day. */
export function demoNow(clock: DemoClock | null, real: Date, timezone: string): Date {
  if (!clock) return real;
  const today = addDays(parseIsoDate(clock.anchorDay0), clock.offsetDays);
  if (clock.timeOfDay) {
    const start = zonedDateTime(toIsoDate(today), clock.timeOfDay.clock, timezone);
    return new Date(start.getTime() + (real.getTime() - Date.parse(clock.timeOfDay.realAt)));
  }
  const realDayStart = zonedDayStart(localIsoDate(real, timezone), timezone);
  const timeOfDay = real.getTime() - realDayStart.getTime();
  return new Date(zonedDayStart(today.toISOString().slice(0, 10), timezone).getTime() + timeOfDay);
}

/** Reads the demo clock with any client (the worker has no Nest container). */
export async function readDemoClock(db: {
  systemSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: unknown } | null> };
}): Promise<DemoClock | null> {
  const row = await db.systemSetting.findUnique({ where: { key: 'demo.clock' } });
  return (row?.value as DemoClock | undefined) ?? null;
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
    const value = await readDemoClock(this.prisma.db);
    this.cached = { value, loadedAt: Date.now() };
    return value;
  }

  async now(timezone = 'Asia/Kolkata'): Promise<Date> {
    return demoNow(await this.demoClock(), new Date(), timezone);
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
