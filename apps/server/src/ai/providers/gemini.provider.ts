import {
  DEFAULT_MAX_TOKENS,
  postJson,
  toMessages,
  type AiProvider,
  type CompletionRequest,
} from './ai-provider.js';

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string = GEMINI_BASE_URL,
  ) {}

  async complete(request: CompletionRequest): Promise<string> {
    const { system, maxTokens } = request;
    const response = await postJson<GenerateContentResponse>(
      `${this.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: toMessages(request).map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : 'user',
          parts: [{ text: content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens ?? DEFAULT_MAX_TOKENS },
      },
      { 'x-goog-api-key': this.apiKey },
    );
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((part) => part.text ?? '')
      .join('')
      .trim();
  }
}
