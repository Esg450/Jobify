import { describe, expect, it } from 'vitest';
import { isDuplicate, normalizeJobUrl } from './duplicates.js';

describe('normalizeJobUrl', () => {
  it('drops the query string, fragment and trailing slash and lower-cases the host', () => {
    expect(normalizeJobUrl('https://Jobs.Example.com/postings/123/?utm_source=x#apply')).toBe(
      'https://jobs.example.com/postings/123',
    );
  });

  it('keeps the query parameters that identify the posting', () => {
    expect(normalizeJobUrl('https://www.indeed.com/viewjob?jk=abc123&from=serp&tk=xyz')).toBe(
      'https://www.indeed.com/viewjob?jk=abc123',
    );
    expect(
      normalizeJobUrl('https://www.linkedin.com/jobs/search/?refId=r&currentJobId=42&trk=t'),
    ).toBe('https://www.linkedin.com/jobs/search?currentjobid=42');
    expect(normalizeJobUrl('https://acme.com/careers?gh_jid=7&utm_source=x')).toBe(
      'https://acme.com/careers?gh_jid=7',
    );
    // Glassdoor (as returned by JobSpy) names the listing with `jl`.
    expect(normalizeJobUrl('https://www.glassdoor.com/job-listing/j?jl=1009')).toBe(
      'https://www.glassdoor.com/job-listing/j?jl=1009',
    );
    expect(normalizeJobUrl('https://www.glassdoor.com/job-listing/j?jl=1009')).not.toBe(
      normalizeJobUrl('https://www.glassdoor.com/job-listing/j?jl=1010'),
    );
    // Different ids on the same page are different postings; the same id in any order is not.
    expect(normalizeJobUrl('https://www.indeed.com/viewjob?jk=1')).not.toBe(
      normalizeJobUrl('https://www.indeed.com/viewjob?jk=2'),
    );
    expect(normalizeJobUrl('https://x.test/j?b=2&jobId=9&a=1')).toBe(
      normalizeJobUrl('https://x.test/j?jobid=9'),
    );
  });

  it('keeps the path case, which can matter on some sites', () => {
    expect(normalizeJobUrl('https://example.com/Jobs/AbC')).toBe('https://example.com/Jobs/AbC');
  });

  it('falls back to the trimmed text when the value is not a URL', () => {
    expect(normalizeJobUrl('  not a url ')).toBe('not a url');
    expect(normalizeJobUrl(null)).toBeNull();
    expect(normalizeJobUrl('')).toBeNull();
  });
});

describe('isDuplicate', () => {
  const existing = {
    title: 'Senior Engineer',
    company: 'Acme',
    url: 'https://acme.com/jobs/1?ref=linkedin',
  };

  it('matches the same URL with different tracking parameters', () => {
    expect(
      isDuplicate(
        { title: 'Different', company: 'Other', url: 'https://acme.com/jobs/1' },
        existing,
      ),
    ).toBe(true);
  });

  it('matches the same title and company ignoring case and spacing', () => {
    expect(isDuplicate({ title: ' senior  engineer', company: 'ACME', url: null }, existing)).toBe(
      true,
    );
  });

  it('does not match when only one of title or company agrees', () => {
    expect(isDuplicate({ title: 'Senior Engineer', company: 'Globex', url: null }, existing)).toBe(
      false,
    );
    expect(
      isDuplicate(
        { title: 'Staff Engineer', company: 'Acme', url: 'https://acme.com/jobs/2' },
        existing,
      ),
    ).toBe(false);
  });
});
