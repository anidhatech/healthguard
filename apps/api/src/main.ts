import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DEMO_DATA_NOTICE } from '@healthguard/shared';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { buildConfig } from './config/env.js';
import { loadRootEnv } from './config/load-env.js';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const config = buildConfig();
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, config);
  await app.listen(config.env.API_PORT, config.env.API_HOST);
  const logger = app.get(Logger);
  logger.log(
    {
      port: config.env.API_PORT,
      demoMode: config.demoMode,
      demoAuth: config.demoAuthEnabled,
      aiProvider: config.aiProvider,
      anthropicKeyConfigured: Boolean(config.env.ANTHROPIC_API_KEY),
      swagger: config.swaggerEnabled,
    },
    `HealthGuard API listening${config.demoMode ? ` (${DEMO_DATA_NOTICE})` : ''}`,
  );
}

bootstrap().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
