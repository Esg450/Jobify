import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { EmbeddedJsonParser, extractJsonFromScript } from './embedded-json.parser.js';

const JOB = {
  postingTitle: 'US - Specialist: Seasonal, Part-time',
  jobSummary: 'Apple Retail is where the best of Apple comes together. '.repeat(5),
  description: 'Deliver excellent service to customers. '.repeat(6),
  minimumQualifications: 'You should have availability to work weekends.',
  locations: [{ name: 'United States', code: 'USA' }],
  postingDate: 'Sep 28, 2026',
  jobType: 'RETAIL',
};

describe('EmbeddedJsonParser', () => {
  const parser = new EmbeddedJsonParser();

  it('reads a posting from Next.js style data', async () => {
    const data = {
      props: {
        pageProps: {
          job: { ...JOB, company: { name: 'Apple' } },
          other: { name: 'Nav', description: 'x' },
        },
      },
    };
    const page = fakePage({
      html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`,
    });

    const draft = await parser.parse(page);
    expect(draft).toMatchObject({
      title: 'US - Specialist: Seasonal, Part-time',
      company: 'Apple',
      location: 'United States',
      postedOn: '2026-09-28',
    });
    expect(draft?.description).toContain('## Minimum qualifications');
  });

  it('reads JSON.parse("...") hydration data and window assignments', () => {
    const literal = JSON.stringify(JSON.stringify({ a: 1 }));
    const blobs = extractJsonFromScript(
      `window.__data = JSON.parse(${literal}); window.__STATE__ = {"b": [1, "}"]};`,
    );
    expect(blobs).toEqual([{ a: 1 }, { b: [1, '}'] }]);
  });

  it('prefers objects with more job fields and reads salary objects', async () => {
    const data = {
      teaser: {
        title: 'Engineer',
        description: 'Short but long enough to count as a description. '.repeat(5),
      },
      job: {
        title: 'Engineer',
        description: 'The full description of the role. '.repeat(8),
        employer: 'Acme',
        location: { city: 'Berlin', country: 'Germany' },
        employmentType: 'FULL_TIME',
        remote: true,
        salary: { min: 70000, max: 90000, currency: 'EUR', interval: 'year' },
        url: 'https://acme.com/jobs/1',
      },
    };
    const page = fakePage({
      html: `<script>window.__INITIAL_STATE__ = ${JSON.stringify(data)};</script>`,
    });

    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Engineer',
      company: 'Acme',
      location: 'Berlin, Germany',
      employmentType: 'full_time',
      workplaceType: 'remote',
      salaryMin: 70000,
      salaryMax: 90000,
      salaryCurrency: 'EUR',
      salaryPeriod: 'year',
      url: 'https://acme.com/jobs/1',
    });
  });

  it('skips UI translations and reads descriptions split into sections', async () => {
    const data = {
      i18n: {
        title: '{{companyName}} uses AI to analyze applications',
        description: 'x'.repeat(300),
      },
      jobPost: {
        name: 'Lead Engineer',
        description: { company: '<p>About us.</p>', role: `<p>${'The role. '.repeat(30)}</p>` },
        workLocations: ['Remote (United States)'],
        companyName: 'Root Insurance',
        createdOn: '2026-08-24T07:58:53-07:00',
      },
    };
    const page = fakePage({
      html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`,
    });
    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Lead Engineer',
      company: 'Root Insurance',
      location: 'Remote (United States)',
      postedOn: '2026-08-24',
      description: expect.stringContaining('About us.'),
    });
  });

  it('returns null when scripts hold no posting', async () => {
    const page = fakePage({
      html: '<script type="application/json">{"user":{"name":"x","description":"short"}}</script>',
    });
    await expect(parser.parse(page)).resolves.toBeNull();
  });
});
