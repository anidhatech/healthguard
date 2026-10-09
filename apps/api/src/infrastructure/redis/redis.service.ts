import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';

/** Cache, rate limits and queues. Nothing in Redis is a source of truth. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger('Redis');

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    this.client.on('error', (error: Error) => this.logger.warn(`Redis error: ${error.message}`));
  }

  async ping(): Promise<number> {
    const started = performance.now();
    if (this.client.status !== 'ready') {
      // Right after start-up the connection may still be opening.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Redis not ready')), 2000);
        this.client.once('ready', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await this.client.ping();
    return Math.round(performance.now() - started);
  }

  /** Increments a counter that expires; null when Redis is unavailable. */
  async incrementWindow(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      const results = await this.client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
      const value = results?.[0]?.[1];
      return typeof value === 'number' ? value : null;
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
    return Promise.resolve();
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
