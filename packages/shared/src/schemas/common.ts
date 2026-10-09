import { z } from 'zod';
import {
  CONTENT_KINDS,
  PROVENANCE_VERIFICATIONS,
  RECORD_SOURCES,
  STAFF_READ_PURPOSES,
} from '../enums.js';

export const UuidSchema = z.uuid();
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IsoDateSchema = z.iso.date();

export const PatientIdParamsSchema = z.strictObject({ patientId: UuidSchema });
export type PatientIdParams = z.infer<typeof PatientIdParamsSchema>;

export const IdParamsSchema = z.strictObject({ id: UuidSchema });
export type IdParams = z.infer<typeof IdParamsSchema>;

export const PurposeSchema = z.enum(STAFF_READ_PURPOSES);

export const ResponseMetaSchema = z.object({
  requestId: z.string(),
  generatedAt: IsoDateTimeSchema,
  synthetic: z.boolean(),
  dataNotice: z.string().optional(),
  nextCursor: z.string().nullable().optional(),
});
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

/** Every successful JSON response is `{ data, meta }`. */
export function envelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: ResponseMetaSchema });
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export const ContentKindSchema = z.enum(CONTENT_KINDS);

/** Inline provenance carried by every recorded clinical fact. */
export const ProvenanceSchema = z.object({
  recordSource: z.enum(RECORD_SOURCES),
  sourceSystem: z.string().nullable(),
  verification: z.enum(PROVENANCE_VERIFICATIONS).nullable(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** A reference from a derived item to the fact or calculation it rests on. */
export const SourceRefSchema = z.object({
  type: z.string(),
  id: z.string().nullable(),
  label: z.string().optional(),
  locator: z.record(z.string(), z.unknown()).optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const PersonRefSchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
});
export type PersonRef = z.infer<typeof PersonRefSchema>;
