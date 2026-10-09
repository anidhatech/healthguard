import { z } from 'zod';

/**
 * Structured-output JSON schemas accept a subset of JSON Schema. We strip
 * numeric/length/format constraints the provider may not support and close
 * every object. zod re-validates the full constraints after parsing, so
 * nothing is lost.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'uniqueItems',
]);

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== 'object') return node;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    result[key] = clean(value);
  }
  if (result.type === 'object') result.additionalProperties = false;
  return result;
}

export function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return clean(z.toJSONSchema(schema, { target: 'draft-2020-12' })) as Record<string, unknown>;
}
