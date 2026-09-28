import {
  DEFAULT_MAX_TOKENS,
  postJson,
  type AiProvider,
  type CompletionRequest,
} from './ai-provider.js';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI's Chat Completions API. Also works with any OpenAI-compatible server
 * (OpenRouter, Groq, LM Studio, vLLM, ...) by changing the base URL.
 */
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly baseUrl: string = OPENAI_BASE_URL,
  ) {}

  async complete({ system, prompt, maxTokens }: CompletionRequest): Promise<string> {
    const response = await postJson<ChatCompletionResponse>(
      `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        model: this.model,
        max_completion_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      },
      this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
    );
    return response.choices?.[0]?.message?.content?.trim() ?? '';
  }
}
