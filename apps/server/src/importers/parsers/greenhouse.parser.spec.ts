import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { GreenhouseParser } from './greenhouse.parser.js';

describe('GreenhouseParser', () => {
  const parser = new GreenhouseParser();

  it.each([
    ['https://boards.greenhouse.io/acme/jobs/123', { board: 'acme', jobId: '123' }],
    ['https://job-boards.greenhouse.io/acme/jobs/123?gh_src=x', { board: 'acme', jobId: '123' }],
    [
      'https://boards.greenhouse.io/embed/job_app?for=acme&token=123',
      { board: 'acme', jobId: '123' },
    ],
    ['https://boards.greenhouse.io/acme', undefined],
  ])('extracts ids from %s', (url, expected) => {
    expect(GreenhouseParser.boardAndJob(new URL(url))).toEqual(expected);
  });

  it('decodes the escaped description and converts pay ranges from cents', async () => {
    const page = fakePage({
      url: 'https://boards.greenhouse.io/acme/jobs/123',
      responses: {
        'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123?pay_transparency=true': {
          title: 'Designer',
          company_name: 'Acme',
          location: { name: 'Remote, Canada' },
          content: '&lt;h2&gt;Role&lt;/h2&gt;&lt;p&gt;Design.&lt;/p&gt;',
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/123',
          first_published: '2026-01-15T12:00:00-05:00',
          pay_input_ranges: [{ min_cents: 9_000_000, max_cents: 12_000_000, currency_type: 'CAD' }],
        },
      },
    });

    const draft = await parser.parse(page);
    expect(draft).toMatchObject({
      title: 'Designer',
      company: 'Acme',
      workplaceType: 'remote',
      description: '## Role\n\nDesign.',
      postedOn: '2026-01-15',
      salaryMin: 90_000,
      salaryMax: 120_000,
      salaryCurrency: 'CAD',
      salaryPeriod: 'year',
    });
  });
});
