import { postJson, type AiProvider, type CompletionRequest } from './ai-provider.js';

interface OllamaChatResponse {
  message?: { content?: string };
}

export const OLLAMA_BASE_URL = 'http://localhost:11434';

/** A local model served by Ollama. No API key required. */
export class OllamaProvider implements AiProvider {
  constructor(
    private readonly model: string,
    private readonly baseUrl: string = OLLAMA_BASE_URL,
  ) {}

  async complete({ system, prompt }: CompletionRequest): Promise<string> {
    const response = await postJson<OllamaChatResponse>(
      `${this.baseUrl.replace(/\/+$/, '')}/api/chat`,
      {
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      },
    );
    return response.message?.content?.trim() ?? '';
  }
}
