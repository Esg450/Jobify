import { cleanText } from '../importers/normalize.js';

/** A job board search the AI proposed from the candidate's profile. */
export interface SearchSuggestion {
  terms: string;
  location?: string;
  remote: boolean;
}

export const MAX_SUGGESTIONS = 6;

/** Parses the model's JSON answer defensively, keeping only well-formed, distinct searches. */
export function parseSearchSuggestions(answer: string): SearchSuggestion[] {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI response did not contain JSON');

  let data: { searches?: unknown };
  try {
    data = JSON.parse(answer.slice(start, end + 1)) as { searches?: unknown };
  } catch {
    throw new Error('The AI response was not valid JSON');
  }
  if (!Array.isArray(data.searches)) throw new Error('The AI response had no searches');

  const seen = new Set<string>();
  const suggestions: SearchSuggestion[] = [];
  for (const item of data.searches as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const { terms, location, remote } = item as Record<string, unknown>;
    const phrase = cleanText(typeof terms === 'string' ? terms : undefined)?.slice(0, 80);
    if (!phrase || seen.has(phrase.toLowerCase())) continue;
    seen.add(phrase.toLowerCase());
    suggestions.push({
      terms: phrase,
      location: cleanText(typeof location === 'string' ? location : undefined)?.slice(0, 100),
      remote: remote === true,
    });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  if (suggestions.length === 0) throw new Error('The AI did not suggest any searches');
  return suggestions;
}
