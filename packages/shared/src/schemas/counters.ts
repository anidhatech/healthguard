import { z } from 'zod';
import { UuidSchema } from './common.js';

/** A counter id as ABDM takes it in a counter QR code: 1 to 20 letters or digits. */
export const CounterCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,20}$/, 'Use 1 to 20 letters or digits');

export const CreateCounterSchema = z.strictObject({
  code: CounterCodeSchema,
  name: z.string().trim().min(1).max(100),
});
export type CreateCounter = z.infer<typeof CreateCounterSchema>;

export const CounterViewSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  /** What the counter's QR code holds. Null until the clinic has a facility id. */
  qrUrl: z.string().nullable(),
  /** Patients waiting at this counter now. */
  waiting: z.number().int(),
});
export type CounterView = z.infer<typeof CounterViewSchema>;

export const CounterListSchema = z.object({
  /** The clinic's facility id in the Health Facility Registry, when it has one. */
  facilityId: z.string().nullable(),
  /** Whether this deployment accepts profiles shared at a counter. */
  sharingOn: z.boolean(),
  counters: z.array(CounterViewSchema),
});
export type CounterList = z.infer<typeof CounterListSchema>;

export const QueueEntryViewSchema = z.object({
  id: UuidSchema,
  tokenNumber: z.number().int(),
  status: z.enum(['ACTIVE', 'CLOSED']),
  /** `SENT` once ABDM accepted the reply that carries the token to the patient's app. */
  replyStatus: z.string(),
  arrivedAt: z.string(),
  patient: z.object({ id: UuidSchema, mrn: z.string(), displayName: z.string() }),
});
export type QueueEntryView = z.infer<typeof QueueEntryViewSchema>;

export const CounterParamsSchema = z.strictObject({ counterId: UuidSchema });
export type CounterParams = z.infer<typeof CounterParamsSchema>;
export const QueueEntryParamsSchema = z.strictObject({ entryId: UuidSchema });
export type QueueEntryParams = z.infer<typeof QueueEntryParamsSchema>;
