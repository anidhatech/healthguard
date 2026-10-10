import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/**
 * Every setting the API reads, validated once at start-up. Secrets come only
 * from the environment and are never logged or returned by any endpoint.
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    APP_BASE_URL: z.url().default('http://localhost:3000'),
    API_PUBLIC_URL: z.url().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().optional(),
    TRUST_PROXY: bool.default(false),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

    DEMO_MODE: bool.default(false),
    ALLOW_DEMO_IN_PRODUCTION: bool.default(false),
    DEMO_AUTH_ENABLED: bool.optional(),
    // Used only to (re)seed the synthetic demo accounts; never a real credential.
    DEMO_ACCOUNT_PASSWORD: z.string().min(8).default('HealthGuard-Demo-2026'),
    PASSWORD_LOGIN_ENABLED: bool.default(true),

    JWT_PRIVATE_KEY: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    JWT_ISSUER: z.string().default('healthguard-api'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2_592_000).default(604_800),
    COOKIE_SECURE: bool.optional(),
    IDENTIFIER_HASH_KEY: z.string().optional(),

    AI_PROVIDER: z.enum(['demo', 'anthropic', 'claude']).default('demo'),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default('claude-sonnet-5-5'),
    AI_FAST_MODEL: z.string().default('claude-haiku-5-5'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    AI_FALLBACK_TO_DEMO: bool.default(true),

    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
    AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LOG_PRETTY: bool.default(false),
    SWAGGER_ENABLED: bool.optional(),
    ABDM_ADAPTER: z.enum(['disabled', 'sandbox-mock']).default('disabled'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEMO_MODE && !env.ALLOW_DEMO_IN_PRODUCTION) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_MODE'],
        message: 'DEMO_MODE in a production build requires ALLOW_DEMO_IN_PRODUCTION=true',
      });
    }
    if (
      (env.AI_PROVIDER === 'anthropic' || env.AI_PROVIDER === 'claude') &&
      !env.ANTHROPIC_API_KEY &&
      !env.AI_FALLBACK_TO_DEMO
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY (or AI_FALLBACK_TO_DEMO=true)',
      });
    }
    if (Boolean(env.JWT_PRIVATE_KEY) !== Boolean(env.JWT_PUBLIC_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_PUBLIC_KEY'],
        message: 'Set both JWT keys or neither',
      });
    }
    if (env.NODE_ENV === 'production' && !env.JWT_PRIVATE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_PRIVATE_KEY'],
        message: 'JWT keys are required in production',
      });
    }
  });
export type Env = z.infer<typeof EnvSchema>;

export interface AppConfig {
  env: Env;
  isProduction: boolean;
  demoMode: boolean;
  demoAuthEnabled: boolean;
  passwordLoginEnabled: boolean;
  corsOrigins: string[];
  cookieSecure: boolean;
  swaggerEnabled: boolean;
  aiProvider: 'DEMO' | 'ANTHROPIC';
  identifierHashKey: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function buildConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  return {
    env,
    isProduction,
    demoMode: env.DEMO_MODE,
    demoAuthEnabled: env.DEMO_MODE && (env.DEMO_AUTH_ENABLED ?? true),
    passwordLoginEnabled: env.PASSWORD_LOGIN_ENABLED,
    corsOrigins: (env.CORS_ORIGINS ?? env.APP_BASE_URL)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    cookieSecure: env.COOKIE_SECURE ?? env.APP_BASE_URL.startsWith('https://'),
    swaggerEnabled: env.SWAGGER_ENABLED ?? (!isProduction || env.DEMO_MODE),
    aiProvider: env.AI_PROVIDER === 'demo' ? 'DEMO' : 'ANTHROPIC',
    // A fixed key is acceptable only for synthetic demo data.
    identifierHashKey: env.IDENTIFIER_HASH_KEY ?? 'healthguard-demo-identifier-hash-key',
  };
}
