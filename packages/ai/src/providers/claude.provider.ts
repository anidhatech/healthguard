import Anthropic from '@anthropic-ai/sdk';
import { toProviderJsonSchema } from '../json-schema.js';
import { AIProviderError, type AIProvider, type AIRequest, type AIResponse } from '../types.js';

export interface ClaudeProviderOptions {
  /** Read from the environment by the caller. Never hardcoded, never logged. */
  apiKey: string | undefined;
  defaultModel: string;
  fastModel: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Test seam: inject a client. */
  client?: Pick<Anthropic, 'messages'>;
}

/**
 * Claude via the Anthropic Messages API with structured JSON output. The
 * system prompt is cached; the fact sheet travels in the user turn. The
 * returned JSON is always re-validated with zod by this provider and then
 * checked by the safety validators by the orchestrator.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = 'ANTHROPIC' as const;
  private readonly client: Pick<Anthropic, 'messages'> | null;

  constructor(private readonly options: ClaudeProviderOptions) {
    this.client =
      options.client ??
      (options.apiKey
        ? new Anthropic({
            apiKey: options.apiKey,
            timeout: options.timeoutMs ?? 30_000,
            maxRetries: options.maxRetries ?? 2,
          })
        : null);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    if (!this.client) {
      throw new AIProviderError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not configured');
    }
    const model =
      request.prompt.modelTier === 'fast' ? this.options.fastModel : this.options.defaultModel;
    const started = performance.now();
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model,
        max_tokens: request.prompt.maxTokens,
        system: [
          { type: 'text', text: request.prompt.system, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: request.prompt.user }],
        output_config: {
          format: { type: 'json_schema', schema: toProviderJsonSchema(request.outputSchema) },
        },
      });
    } catch (error) {
      throw new AIProviderError('UPSTREAM', 'The AI provider request failed', error);
    }
    const latencyMs = Math.round(performance.now() - started);

    if (message.stop_reason === 'refusal') {
      throw new AIProviderError('REFUSAL', 'The model declined the request');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new AIProviderError('TRUNCATED', 'The model output was cut off');
    }
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new AIProviderError('INVALID_OUTPUT', 'The model did not return JSON', error);
    }
    const parsed = request.outputSchema.safeParse(json);
    if (!parsed.success) {
      throw new AIProviderError(
        'INVALID_OUTPUT',
        'Model output failed schema validation',
        parsed.error,
      );
    }
    return {
      output: parsed.data,
      provider: 'ANTHROPIC',
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      latencyMs,
    };
  }
}
