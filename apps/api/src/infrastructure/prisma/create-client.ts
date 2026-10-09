import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

/** A Prisma client over node-postgres. Used by the API, the worker and the seed. */
export function createPrismaClient(connectionString: string, options: { log?: boolean } = {}) {
  const adapter = new PrismaPg({ connectionString, max: 10 });
  return new PrismaClient({
    adapter,
    log: options.log ? ['warn', 'error'] : ['error'],
  });
}

export type DbClient = ReturnType<typeof createPrismaClient>;
