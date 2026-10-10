import {
  Global,
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '@healthguard/shared';
import type { IncomingMessage } from 'node:http';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { CsrfGuard, RateLimitGuard, RolesGuard } from './common/guards.js';
import { ProblemDetailsFilter } from './common/problem.filter.js';
import { RequestContextMiddleware } from './common/request-context.middleware.js';
import { APP_CONFIG, type AppConfig } from './config/env.js';
import { ClockModule } from './infrastructure/clock/clock.service.js';
import { PrismaModule } from './infrastructure/prisma/prisma.service.js';
import { RedisModule } from './infrastructure/redis/redis.service.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AdherenceModule } from './modules/adherence/adherence.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { AuditModule } from './modules/audit/audit.controller.js';
import { AuditCoreModule } from './modules/audit/audit.service.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CareTeamModule } from './modules/care-team/care-team.module.js';
import { DosesModule } from './modules/doses/doses.module.js';
import { CliniciansModule } from './modules/clinicians/clinicians.module.js';
import { ConsentModule } from './modules/consent/consent.module.js';
import { DemoModule } from './modules/demo/demo.module.js';
import { EncountersModule } from './modules/encounters/encounters.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { FollowUpsModule } from './modules/follow-ups/follow-ups.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InteroperabilityModule } from './modules/interoperability/interoperability.module.js';
import { LabsModule } from './modules/labs/labs.module.js';
import { MedicationsModule } from './modules/medications/medications.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { RecordsModule } from './modules/records/records.module.js';

@Global()
@Module({})
class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

/** Never log credentials, cookies or bodies (bodies may hold health data). */
export const LOG_REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

@Module({})
export class AppModule implements NestModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.env.LOG_LEVEL,
            redact: { paths: LOG_REDACT, censor: '[redacted]' },
            genReqId: (request: IncomingMessage) => {
              const header = request.headers[REQUEST_ID_HEADER.toLowerCase()];
              return typeof header === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(header)
                ? header
                : randomUUID();
            },
            customProps: () => ({ service: 'healthguard-api' }),
            serializers: {
              req: (request: { id: string; method: string; url: string }) => ({
                id: request.id,
                method: request.method,
                // Drop query strings: they can carry search terms.
                url: request.url.split('?')[0],
              }),
            },
            ...(config.env.LOG_PRETTY
              ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
              : {}),
            autoLogging: { ignore: (request: IncomingMessage) => request.url === '/health' },
          },
        }),
        PrismaModule,
        RedisModule,
        ClockModule,
        AuditCoreModule,
        AuthModule,
        ConsentModule,
        HealthModule,
        DemoModule,
        OrganizationsModule,
        PatientsModule,
        CliniciansModule,
        EncountersModule,
        RecordsModule,
        MedicationsModule,
        AdherenceModule,
        DosesModule,
        CareTeamModule,
        LabsModule,
        ActivityModule,
        AppointmentsModule,
        FollowUpsModule,
        NotificationsModule,
        AuditModule,
        FilesModule,
        InteroperabilityModule,
        AiModule,
      ],
      providers: [
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
