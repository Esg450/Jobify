import { postJson, toMessages, type AiProvider, type CompletionRequest } from './ai-provider.js';

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

  async complete(request: CompletionRequest): Promise<string> {
    const response = await postJson<OllamaChatResponse>(
      `${this.baseUrl.replace(/\/+$/, '')}/api/chat`,
      {
        model: this.model,
        stream: false,
        messages: [{ role: 'system', content: request.system }, ...toMessages(request)],
      },
    );
    return response.message?.content?.trim() ?? '';
  }
}
