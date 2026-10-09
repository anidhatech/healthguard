import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DoctorBriefSynthesisSchema } from '@healthguard/shared';
import { AIProviderError, type AIProvider, type AIRequest, type AIResponse } from '../types.js';
import { composeDoctorBrief } from './doctor-brief-composer.js';

export const DEFAULT_FIXTURES_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url));

/**
 * Deterministic provider for demos, tests and machines without an API key.
 * It returns a recorded fixture when one exists for the exact input hash,
 * otherwise a template composition of the fact sheet. It never calls out.
 */
export class DemoAIProvider implements AIProvider {
  readonly name = 'DEMO' as const;

  constructor(private readonly fixturesDir: string = DEFAULT_FIXTURES_DIR) {}

  isConfigured(): boolean {
    return true;
  }

  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    const started = performance.now();
    const fixturePath = `${this.fixturesDir}/${request.task}/${request.inputHash}.json`;
    let raw: unknown;
    let model: string;
    if (existsSync(fixturePath)) {
      raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
      model = 'demo-recorded-fixture';
    } else if (request.task === 'DOCTOR_BRIEF_SYNTHESIS') {
      raw = DoctorBriefSynthesisSchema.parse(composeDoctorBrief(request.factSheet));
      model = 'demo-template-composer-v1';
    } else {
      return Promise.reject(
        new AIProviderError(
          'NOT_CONFIGURED',
          `The demo provider has no composer for ${request.task}`,
        ),
      );
    }
    const parsed = request.outputSchema.safeParse(raw);
    if (!parsed.success) {
      return Promise.reject(
        new AIProviderError(
          'INVALID_OUTPUT',
          'Demo output does not match the task schema',
          parsed.error,
        ),
      );
    }
    return Promise.resolve({
      output: parsed.data,
      provider: 'DEMO',
      model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: Math.round(performance.now() - started),
    });
  }
}
