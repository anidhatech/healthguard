import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { createPrismaClient, type DbClient } from './create-client.js';
import { forTenant, type TenantClient } from './tenant-extension.js';

/**
 * Database access. `db` is the unscoped client for global reference data,
 * identity and cross-tenant lookups the access layer performs itself.
 * `tenant(orgId)` returns a client that scopes every tenant-owned model to
 * one organization in the query itself, so isolation never depends on the
 * caller remembering a `where` clause.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: DbClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.db = createPrismaClient(config.env.DATABASE_URL, { log: !config.isProduction });
  }

  tenant(organizationId: string): TenantClient {
    return forTenant(this.db, organizationId);
  }

  async ping(): Promise<number> {
    const started = performance.now();
    await this.db.$queryRaw`SELECT 1`;
    return Math.round(performance.now() - started);
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
