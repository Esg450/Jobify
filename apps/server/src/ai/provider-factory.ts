import { AI_PROVIDERS, type AiSettings } from './ai-settings.js';
import { AiProviderError, type AiProvider } from './providers/ai-provider.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';

/** Returns a human-readable reason the settings are unusable, or undefined if they are fine. */
export function validateAiSettings(settings: AiSettings): string | undefined {
  const info = AI_PROVIDERS.find((provider) => provider.id === settings.provider);
  if (!info) return 'No AI provider is configured. Choose one in Settings.';
  if (info.requiresApiKey && !settings.apiKey) return `${info.label} requires an API key.`;
  if (info.requiresBaseUrl && !settings.baseUrl) return `${info.label} requires a base URL.`;
  if (!settings.model && !info.defaultModel) return `Choose a model for ${info.label}.`;
  return undefined;
}

export function createAiProvider(settings: AiSettings): AiProvider {
  const problem = validateAiSettings(settings);
  if (problem) throw new AiProviderError(problem);

  const info = AI_PROVIDERS.find((provider) => provider.id === settings.provider)!;
  const model = settings.model || info.defaultModel!;
  const baseUrl = settings.baseUrl || undefined;

  switch (settings.provider!) {
    case 'anthropic':
      return new AnthropicProvider(settings.apiKey, model, baseUrl);
    case 'openai':
    case 'openai_compatible':
      return new OpenAiProvider(settings.apiKey || undefined, model, baseUrl);
    case 'gemini':
      return new GeminiProvider(settings.apiKey, model, baseUrl);
    case 'ollama':
      return new OllamaProvider(model, baseUrl);
  }
}
