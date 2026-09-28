import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export const AI_PROVIDER_IDS = [
  'anthropic',
  'openai',
  'gemini',
  'ollama',
  'openai_compatible',
] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultModel?: string;
  defaultBaseUrl?: string;
  modelHint: string;
}

export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultModel: 'claude-opus-5-5',
    modelHint: 'e.g. claude-opus-5-5 or claude-haiku-4-5',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    modelHint: 'Any chat model available to your API key',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    requiresBaseUrl: false,
    modelHint: 'Any Gemini model available to your API key',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    requiresApiKey: false,
    requiresBaseUrl: false,
    defaultBaseUrl: 'http://localhost:11434',
    modelHint: 'A model you have pulled, e.g. llama3.1',
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI-compatible API',
    requiresApiKey: false,
    requiresBaseUrl: true,
    modelHint: 'OpenRouter, Groq, LM Studio, vLLM, ...',
  },
];

export interface AiSettings {
  provider: AiProviderId | null;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/** AI settings as returned to the browser: the API key is never sent back. */
export type PublicAiSettings = Omit<AiSettings, 'apiKey'> & {
  hasApiKey: boolean;
  configured: boolean;
};

export class UpdateAiSettingsDto {
  @ValidateIf((_, value) => value !== null)
  @IsIn(AI_PROVIDER_IDS)
  provider!: AiProviderId | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  /** Omit to keep the stored key; send an empty string to remove it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;
}
