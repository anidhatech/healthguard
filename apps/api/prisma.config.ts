import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// Local runs read the repository's root .env; containers pass real env vars.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ?? 'postgresql://healthguard:healthguard@localhost:5432/healthguard',
  },
});
