import Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderError,
  DEFAULT_MAX_TOKENS,
  type AiProvider,
  type CompletionRequest,
} from './ai-provider.js';

/** Models that accept server-side fallbacks when a request is declined by safety classifiers. */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    baseUrl?: string,
  ) {
    this.client = new Anthropic({ apiKey, baseURL: baseUrl || undefined });
  }

  async complete({ system, prompt, maxTokens }: CompletionRequest): Promise<string> {
    const fallback = FALLBACK_MODELS.has(this.model)
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
      : {};

    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: prompt }],
        ...fallback,
      });

      if (response.stop_reason === 'refusal') {
        throw new AiProviderError('Claude declined to answer this request');
      }
      return response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim();
    } catch (error) {
      throw AnthropicProvider.toProviderError(error);
    }
  }

  private static toProviderError(error: unknown): Error {
    if (error instanceof AiProviderError) return error;
    if (error instanceof Anthropic.AuthenticationError) {
      return new AiProviderError('Anthropic rejected the API key');
    }
    if (error instanceof Anthropic.NotFoundError) {
      return new AiProviderError('Anthropic does not recognise that model');
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new AiProviderError('Anthropic rate limit reached, try again shortly');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new AiProviderError(`Could not reach Anthropic: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      return new AiProviderError(`Anthropic error (${error.status}): ${error.message}`);
    }
    return error as Error;
  }
}
