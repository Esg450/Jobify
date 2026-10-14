import { describe, expect, it } from 'vitest';
import type { JobDraft, SearchResult } from '../api/types';
import { sortResults } from './searchSort';

function result(id: string, draft: JobDraft): SearchResult {
  return { id, site: 'indeed', draft: { title: 'Engineer', ...draft }, existing: null };
}

const results: SearchResult[] = [
  result('a', { company: 'Globex', postedOn: '2026-10-01', salaryMax: 50, salaryPeriod: 'hour' }),
  result('b', { company: 'acme', postedOn: '2026-10-10' }),
  result('c', { company: 'Initech', salaryMin: 120000, salaryMax: 150000, salaryPeriod: 'year' }),
  result('d', {
    company: 'Umbrella',
    postedOn: '2026-10-05',
    salaryMin: 9000,
    salaryPeriod: 'month',
  }),
];

const ids = (sorted: SearchResult[]): string[] => sorted.map((r) => r.id);

describe('sortResults', () => {
  it('keeps the boards’ order for relevance', () => {
    expect(ids(sortResults(results, 'relevance'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts the newest postings first and undated ones last', () => {
    expect(ids(sortResults(results, 'newest'))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('compares pay as a yearly amount and puts unknown pay last', () => {
    // a: 50/h ≈ 104k, c: 150k, d: 9k/month = 108k
    expect(ids(sortResults(results, 'salary'))).toEqual(['c', 'd', 'a', 'b']);
  });

  it('sorts companies alphabetically, ignoring case', () => {
    expect(ids(sortResults(results, 'company'))).toEqual(['b', 'a', 'c', 'd']);
  });

  it('does not change the original list', () => {
    sortResults(results, 'company');
    expect(ids(results)).toEqual(['a', 'b', 'c', 'd']);
  });
});
