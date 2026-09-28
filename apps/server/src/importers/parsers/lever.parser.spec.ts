import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { LeverParser } from './lever.parser.js';

describe('LeverParser', () => {
  const parser = new LeverParser();

  it('matches Lever job pages in both regions', () => {
    expect(parser.matches(new URL('https://jobs.lever.co/acme/abc'))).toBe(true);
    expect(parser.matches(new URL('https://jobs.eu.lever.co/acme/abc'))).toBe(true);
    expect(parser.matches(new URL('https://lever.co'))).toBe(false);
  });

  it('combines the posting sections and leaves the company for other parsers', async () => {
    const page = fakePage({
      url: 'https://jobs.eu.lever.co/acme/1234-abcd',
      responses: {
        'https://api.eu.lever.co/v0/postings/acme/1234-abcd': {
          text: 'Support Engineer',
          categories: { location: 'Dublin', commitment: 'Full-time' },
          workplaceType: 'hybrid',
          description: '<p>Help customers.</p>',
          lists: [{ text: 'Requirements', content: '<li>Empathy</li>' }],
          createdAt: Date.UTC(2026, 4, 2),
          salaryRange: { min: 50000, max: 60000, currency: 'EUR', interval: 'per-year-salary' },
        },
      },
    });

    const draft = await parser.parse(page);
    expect(draft).toMatchObject({
      title: 'Support Engineer',
      location: 'Dublin',
      workplaceType: 'hybrid',
      employmentType: 'full_time',
      description: 'Help customers.\n\n### Requirements\n\n- Empathy',
      postedOn: '2026-05-02',
      salaryMin: 50000,
      salaryMax: 60000,
      salaryCurrency: 'EUR',
      salaryPeriod: 'year',
    });
    expect(draft?.company).toBeUndefined();
  });
});
