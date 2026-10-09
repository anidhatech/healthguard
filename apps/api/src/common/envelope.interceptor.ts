import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEMO_DATA_NOTICE, type ApiEnvelope } from '@healthguard/shared';
import { map, type Observable } from 'rxjs';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import type { HealthGuardRequest } from './actor.js';
import { RAW_RESPONSE } from './decorators.js';

/** Wraps every JSON result as `{ data, meta }`; demo responses carry the banner. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw || context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<HealthGuardRequest>();
    return next.handle().pipe(
      map((data: unknown): ApiEnvelope<unknown> => ({
        data: data ?? null,
        meta: {
          requestId: request.meta?.requestId ?? 'unknown',
          generatedAt: new Date().toISOString(),
          synthetic: this.config.demoMode,
          ...(this.config.demoMode ? { dataNotice: DEMO_DATA_NOTICE } : {}),
        },
      })),
    );
  }
}
