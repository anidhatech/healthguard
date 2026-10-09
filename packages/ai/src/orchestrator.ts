import {
  DoctorBriefSynthesisSchema,
  type AiInteractionStatus,
  type AiProviderName,
  type Confidence,
  type DoctorBriefSynthesis,
  type ValidationCheck,
} from '@healthguard/shared';
import { hashInput } from './hashing.js';
import type { PromptRegistry } from './prompts/registry.js';
import { validateDoctorBrief } from './safety/validators.js';
import { AIProviderError, type AIProvider, type FactSheet, type RenderedPrompt } from './types.js';

export interface DoctorBriefRun {
  status: AiInteractionStatus;
  provider: AiProviderName;
  model: string;
  prompt: RenderedPrompt;
  inputHash: string;
  output: DoctorBriefSynthesis | null;
  confidence: Confidence | null;
  checks: ValidationCheck[];
  fallbackReason: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface OrchestratorDeps {
  prompts: PromptRegistry;
  primary: AIProvider;
  /** Deterministic fallback; null disables fallback. */
  fallback: AIProvider | null;
}

/**
 * Runs the doctor-brief task: render the versioned prompt, call the primary
 * provider, validate the output against the fact sheet, and fall back to the
 * deterministic provider when the primary fails or its output is unusable.
 * The request gate and consent checks run before this, in the caller.
 */
export async function runDoctorBrief(
  deps: OrchestratorDeps,
  factSheet: FactSheet,
  instruction: string | null,
): Promise<DoctorBriefRun> {
  const prompt = deps.prompts.render('DOCTOR_BRIEF_SYNTHESIS', {
    fact_sheet: JSON.stringify(
      factSheet.facts.map(({ id, kind, category, text, effectiveDate }) => ({
        id,
        kind,
        category,
        text,
        effectiveDate,
      })),
      null,
      2,
    ),
    as_of: factSheet.asOf,
    clinician_focus: instruction ?? '(none)',
  });
  const inputHash = hashInput({
    task: 'DOCTOR_BRIEF_SYNTHESIS',
    promptVersion: prompt.version,
    factSheet,
    instruction,
  });
  const request = {
    task: 'DOCTOR_BRIEF_SYNTHESIS' as const,
    prompt,
    factSheet,
    instruction,
    outputSchema: DoctorBriefSynthesisSchema,
    inputHash,
  };

  const attempt = async (provider: AIProvider) => {
    const response = await provider.generate(request);
    return { response, report: validateDoctorBrief(response.output, factSheet) };
  };

  let fallbackReason: string | null = null;
  let primaryChecks: ValidationCheck[] = [];
  if (deps.primary.isConfigured()) {
    try {
      const { response, report } = await attempt(deps.primary);
      if (report.passed && !report.blocking && report.sanitized) {
        return {
          status: 'SUCCEEDED',
          provider: response.provider,
          model: response.model,
          prompt,
          inputHash,
          output: report.sanitized,
          confidence: report.confidence,
          checks: report.checks,
          fallbackReason: null,
          latencyMs: response.latencyMs,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        };
      }
      primaryChecks = report.checks;
      fallbackReason = report.blocking
        ? 'Primary output failed safety validation and was discarded'
        : 'Primary output failed validation';
    } catch (error) {
      fallbackReason =
        error instanceof AIProviderError
          ? `Primary provider error: ${error.kind}`
          : 'Primary provider error';
    }
  } else {
    fallbackReason = 'Primary provider not configured';
  }

  if (!deps.fallback) {
    return {
      status: primaryChecks.length ? 'VALIDATION_FAILED' : 'PROVIDER_ERROR',
      provider: deps.primary.name,
      model: 'none',
      prompt,
      inputHash,
      output: null,
      confidence: null,
      checks: primaryChecks,
      fallbackReason,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const { response, report } = await attempt(deps.fallback);
  const usable = report.passed && !report.blocking && report.sanitized !== null;
  // The demo provider is the configured primary in demo mode: that is not a fallback.
  const isFallback = deps.primary !== deps.fallback && deps.primary.name !== deps.fallback.name;
  return {
    status: !usable ? 'VALIDATION_FAILED' : isFallback ? 'FALLBACK_USED' : 'SUCCEEDED',
    provider: response.provider,
    model: response.model,
    prompt,
    inputHash,
    output: usable ? report.sanitized : null,
    confidence: usable ? report.confidence : null,
    checks: [...primaryChecks, ...report.checks],
    fallbackReason: isFallback ? fallbackReason : null,
    latencyMs: response.latencyMs,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
