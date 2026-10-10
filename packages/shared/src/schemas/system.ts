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

export const SIMULATED_ABDM_LABEL = 'SIMULATED — not connected to ABDM';

/** A simulated health-information link: shows the shape of the flow, nothing leaves HealthGuard. */
export const AbdmSimulationViewSchema = z.object({
  label: z.literal(SIMULATED_ABDM_LABEL),
  linked: z.boolean(),
  linkedAt: z.string().nullable(),
  /** Obviously fake: never a real ABHA address format owned by anyone. */
  simulatedAddress: z.string().nullable(),
  careContexts: z.array(
    z.object({ id: z.string(), display: z.string(), date: z.string().nullable() }),
  ),
  notice: z.string(),
});
export type AbdmSimulationView = z.infer<typeof AbdmSimulationViewSchema>;

export const DeviceSyncResultSchema = z.object({
  adapter: z.literal('synthetic-wearable'),
  label: z.string(),
  daysAdded: z.number().int(),
  todaySteps: z.number().int(),
  syncedAt: z.string(),
});
export type DeviceSyncResult = z.infer<typeof DeviceSyncResultSchema>;

export const DEMO_CHECKPOINT_DAYS = [0, 6, 42, 85, 88, 92] as const;
export type DemoCheckpointDay = (typeof DEMO_CHECKPOINT_DAYS)[number];

export const DemoConsoleSchema = z.object({
  checkpoints: z.array(
    z.object({ day: z.number().int(), title: z.string(), description: z.string() }),
  ),
  currentDay: z.number().int(),
  timeOfDay: z.string().nullable(),
  ai: z.object({
    provider: z.enum(['DEMO', 'ANTHROPIC']),
    claudeAvailable: z.boolean(),
  }),
});
export type DemoConsole = z.infer<typeof DemoConsoleSchema>;

export const DemoResetSchema = z.strictObject({
  checkpointDay: z.union([
    z.literal(0),
    z.literal(6),
    z.literal(42),
    z.literal(85),
    z.literal(88),
    z.literal(92),
  ]),
});
export type DemoReset = z.infer<typeof DemoResetSchema>;

export const DemoClockChangeSchema = z.strictObject({
  /** Local HH:MM to jump to on the current demo day, or null for the real time of day. */
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});
export type DemoClockChange = z.infer<typeof DemoClockChangeSchema>;

export const DemoAiProviderSchema = z.strictObject({
  provider: z.enum(['DEMO', 'ANTHROPIC']),
});
export type DemoAiProvider = z.infer<typeof DemoAiProviderSchema>;
