import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { Problems } from './problem.js';

/**
 * Validates a body, query or params object with a shared zod schema and
 * returns the parsed (coerced, defaulted, stripped) value.
 */
@Injectable()
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw Problems.validation(
        result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '(root)',
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}

export const zod = <T extends z.ZodType>(schema: T) => new ZodPipe(schema);
