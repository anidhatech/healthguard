import type { AiProviderName, AiTaskName, Confidence, ValidationCheck } from '@healthguard/shared';
import type { z } from 'zod';

/** Data categories a fact sheet can carry. Each maps to a consent category. */
export const FACT_CATEGORIES = [
  'ENCOUNTERS',
  'CONDITIONS',
  'ALLERGIES',
  'MEDICATIONS',
  'ADHERENCE',
  'LABS',
  'VITALS',
  'ACTIVITY',
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

/** Where a fact came from, so every AI claim can be traced back to a record. */
export interface FactSource {
  type: string;
  id: string | null;
  label?: string;
}

/**
 * One recorded fact (`f-NN`) or deterministic calculation (`c-NN`). The model
 * only ever sees these: never raw rows, names, phone numbers or identifiers.
 */
export interface Fact {
  id: string;
  kind: 'FACT' | 'CALCULATED';
  category: FactCategory;
  /** Plain statement shown to the model and to the clinician. */
  text: string;
  /** Machine-readable values, used by the template composer and number checks. */
  values: Record<string, string | number | null>;
  /** ISO date the fact applies to. */
  effectiveDate: string | null;
  source: FactSource;
}

export interface FactSheet {
  /** Pseudonymous reference; never a name or medical record number. */
  subjectRef: string;
  asOf: string;
  facts: Fact[];
}

export interface AiTaskDefinition {
  task: AiTaskName;
  implemented: boolean;
  agent: string;
  description: string;
  categories: readonly FactCategory[];
  promptKey: string;
}

export interface RenderedPrompt {
  key: string;
  version: string;
  hash: string;
  system: string;
  user: string;
  maxTokens: number;
  modelTier: 'default' | 'fast';
}

export interface AIRequest<T> {
  task: AiTaskName;
  prompt: RenderedPrompt;
  factSheet: FactSheet;
  instruction: string | null;
  outputSchema: z.ZodType<T>;
  /** Stable hash of task + prompt version + fact sheet + instruction. */
  inputHash: string;
}

export interface AIResponse<T> {
  output: T;
  provider: AiProviderName;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>>;
}

export type AIProviderErrorKind =
  'NOT_CONFIGURED' | 'REFUSAL' | 'TRUNCATED' | 'INVALID_OUTPUT' | 'UPSTREAM';

export class AIProviderError extends Error {
  readonly kind: AIProviderErrorKind;

  constructor(kind: AIProviderErrorKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AIProviderError';
    this.kind = kind;
  }
}

export interface ValidationReport<T> {
  passed: boolean;
  /** True when the output must not be shown at all (unsafe or leaks data). */
  blocking: boolean;
  checks: ValidationCheck[];
  /** The output with any uncited or unsupported items removed. */
  sanitized: T | null;
  confidence: Confidence | null;
  droppedItems: number;
}
