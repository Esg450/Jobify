import { describeFetchError } from '../../common/errors.js';

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/** A text-generation backend. Implementations should throw AiProviderError on failure. */
export interface AiProvider {
  complete(request: CompletionRequest): Promise<string>;
}

/** A failure the user can act on, e.g. a bad API key or unknown model. */
export class AiProviderError extends Error {}

export const DEFAULT_MAX_TOKENS = 16_000;

/** Shared error handling for providers that are called over plain HTTP. */
export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5 * 60_000),
    });
  } catch (error) {
    throw new AiProviderError(`Could not reach ${new URL(url).host}: ${describeFetchError(error)}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AiProviderError(
      `${new URL(url).host} responded with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }
  return (await response.json()) as T;
}
