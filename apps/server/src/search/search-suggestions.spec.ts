import { describe, expect, it } from 'vitest';
import { parseSearchSuggestions } from './search-suggestions.js';

describe('parseSearchSuggestions', () => {
  it('reads the searches out of the JSON, ignoring prose around it', () => {
    const answer = `Here you go:
{"searches": [
  {"terms": " Platform  Engineer ", "location": "Austin, TX", "remote": false},
  {"terms": "site reliability engineer", "remote": true},
  {"terms": "platform engineer", "location": "Dallas"},
  {"terms": "", "remote": true},
  "not an object",
  {"terms": 42}
]}
Good luck!`;
    expect(parseSearchSuggestions(answer)).toEqual([
      { terms: 'Platform Engineer', location: 'Austin, TX', remote: false },
      { terms: 'site reliability engineer', location: undefined, remote: true },
    ]);
  });

  it('caps the list and treats anything but true as not remote', () => {
    const searches = Array.from({ length: 10 }, (_, i) => ({ terms: `role ${i}`, remote: 'yes' }));
    const parsed = parseSearchSuggestions(JSON.stringify({ searches }));
    expect(parsed).toHaveLength(6);
    expect(parsed.every((s) => s.remote === false)).toBe(true);
  });

  it('rejects answers without usable searches', () => {
    expect(() => parseSearchSuggestions('no json here')).toThrow('did not contain JSON');
    expect(() => parseSearchSuggestions('{"searches": "nope"}')).toThrow('no searches');
    expect(() => parseSearchSuggestions('{"searches": [{"terms": ""}]}')).toThrow(
      'did not suggest',
    );
    expect(() => parseSearchSuggestions('{"searches": [}')).toThrow('not valid JSON');
  });
});
