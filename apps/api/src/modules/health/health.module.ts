import { Controller, Get, Module, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse, ReadyResponse } from '@healthguard/shared';
import type { Response } from 'express';
import { Public, RawResponse } from '../../common/decorators.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { SERVICE_NAME, SERVICE_VERSION } from '../../version.js';

async function check(probe: () => Promise<number>) {
  try {
    return { status: 'up' as const, latencyMs: await probe() };
  } catch {
    // Never echo connection strings or driver errors to the caller.
    return { status: 'down' as const, latencyMs: null, error: 'unreachable' };
  }
}

/** Liveness (`/health`) and readiness (`/ready`), outside the versioned API prefix. */
@ApiTags('system')
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @RawResponse()
  @Get('health')
  @ApiOperation({ summary: 'Liveness: the process is up' })
  health(): HealthResponse {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @RawResponse()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness: database and Redis reachable (503 otherwise)' })
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadyResponse> {
    const [database, redis] = await Promise.all([
      check(() => this.prisma.ping()),
      check(() => this.redis.ping()),
    ]);
    const ready = database.status === 'up' && redis.status === 'up';
    response.status(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
