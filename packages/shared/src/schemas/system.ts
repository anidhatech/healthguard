import { z } from 'zod';
import { IsoDateSchema, IsoDateTimeSchema } from './common.js';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number(),
  timestamp: IsoDateTimeSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

const DependencyCheckSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nullable(),
  error: z.string().optional(),
});

export const ReadyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  timestamp: IsoDateTimeSchema,
  checks: z.object({
    database: DependencyCheckSchema,
    redis: DependencyCheckSchema,
  }),
});
export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;

export const DemoStateSchema = z.object({
  demoMode: z.boolean(),
  dataNotice: z.string(),
  clock: z.object({
    anchorDay0: IsoDateSchema,
    offsetDays: z.number().int(),
    today: IsoDateSchema,
    now: IsoDateTimeSchema,
    timezone: z.string(),
  }),
});
export type DemoState = z.infer<typeof DemoStateSchema>;

export const InteropStatusSchema = z.object({
  fhirExport: z.object({ status: z.string(), note: z.string() }),
  abdm: z.object({ adapter: z.string(), status: z.string(), note: z.string() }),
  devices: z.object({ adapter: z.string(), status: z.string(), note: z.string() }),
});
export type InteropStatus = z.infer<typeof InteropStatusSchema>;
