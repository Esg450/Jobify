import { describe, expect, it } from 'vitest';
import type { JobDraft, SearchResult } from '../api/types';
import { filterBySalary, isCustomSalary, SALARY_PRESETS, sortResults } from './searchSort';

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

describe('filterBySalary', () => {
  it('keeps everything when no filter is set', () => {
    expect(ids(filterBySalary(results, { hideUnlisted: false }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps postings whose yearly pay overlaps the range', () => {
    // a ≈ 104k, c: 120k–150k, d: 108k; b has no pay and stays
    expect(ids(filterBySalary(results, { min: 106000, hideUnlisted: false }))).toEqual([
      'b',
      'c',
      'd',
    ]);
    expect(ids(filterBySalary(results, { max: 110000, hideUnlisted: false }))).toEqual([
      'a',
      'b',
      'd',
    ]);
    expect(ids(filterBySalary(results, { min: 140000, max: 200000, hideUnlisted: false }))).toEqual(
      ['b', 'c'],
    );
  });

  it('can hide postings without pay', () => {
    expect(ids(filterBySalary(results, { hideUnlisted: true }))).toEqual(['a', 'c', 'd']);
  });
});

describe('isCustomSalary', () => {
  it('treats no filter and preset minimums as presets', () => {
    expect(isCustomSalary({ hideUnlisted: false })).toBe(false);
    expect(isCustomSalary({ min: SALARY_PRESETS[0], hideUnlisted: true })).toBe(false);
  });

  it('treats other amounts as a custom range', () => {
    expect(isCustomSalary({ min: 90000, hideUnlisted: false })).toBe(true);
    expect(isCustomSalary({ max: 150000, hideUnlisted: false })).toBe(true);
  });

  it('keeps hiding postings without pay visible when no amount is set', () => {
    expect(isCustomSalary({ hideUnlisted: true })).toBe(true);
  });
});
