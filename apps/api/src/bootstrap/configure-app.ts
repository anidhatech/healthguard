import { RequestMethod, VersioningType, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  API_GLOBAL_PREFIX,
  CSRF_HEADER,
  DEMO_AUTH_NOTICE,
  DEMO_DATA_NOTICE,
  PURPOSE_HEADER,
  REQUEST_ID_HEADER,
  SAFETY_STATEMENT,
} from '@healthguard/shared';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from '../config/env.js';
import { SERVICE_VERSION } from '../version.js';

/**
 * Everything that makes the HTTP surface: security headers, cookies, CORS,
 * the `/api/v1` prefix (health checks stay at the root), and Swagger.
 * Shared by `main.ts` and the integration tests so both run the same app.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const http = app.getHttpAdapter().getInstance() as Express;
  http.disable('x-powered-by');
  if (config.env.TRUST_PROXY) http.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Swagger UI needs its own scripts and styles.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      CSRF_HEADER,
      REQUEST_ID_HEADER,
      PURPOSE_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('HealthGuard API')
        .setDescription(
          [
            `**${DEMO_DATA_NOTICE}**`,
            SAFETY_STATEMENT,
            `Authentication: ${DEMO_AUTH_NOTICE}`,
            'Every JSON response is `{ data, meta }`; errors are RFC 9457 problem details with a stable `code`.',
            'Cookie sessions need the `X-CSRF-Token` header (value of the `hg_csrf` cookie) on unsafe methods.',
          ].join('\n\n'),
        )
        .setVersion(SERVICE_VERSION)
        .addCookieAuth('hg_at')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, document, {
      jsonDocumentUrl: `${API_GLOBAL_PREFIX}/docs/openapi.json`,
      customSiteTitle: 'HealthGuard API (demo)',
    });
  }
}
