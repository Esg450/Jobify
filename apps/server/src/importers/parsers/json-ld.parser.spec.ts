import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { JsonLdParser } from './json-ld.parser.js';

const page = (data: unknown) =>
  fakePage({
    html: `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`,
  });

describe('JsonLdParser', () => {
  const parser = new JsonLdParser();

  it('reads a JobPosting nested in @graph', async () => {
    const draft = await parser.parse(
      page({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'Careers' },
          {
            '@type': 'JobPosting',
            title: 'Data Analyst',
            description: '<p>Analyse data.</p>',
            datePosted: '2026-02-01',
            validThrough: '2026-03-01T00:00:00Z',
            employmentType: ['FULL_TIME'],
            hiringOrganization: { '@type': 'Organization', name: 'Initech' },
            jobLocationType: 'TELECOMMUTE',
            jobLocation: [
              { address: { addressLocality: 'Denver', addressRegion: 'CO', addressCountry: 'US' } },
              { address: { addressLocality: 'Denver', addressRegion: 'CO', addressCountry: 'US' } },
            ],
            baseSalary: {
              currency: 'USD',
              value: { minValue: '70000', maxValue: 90000, unitText: 'YEAR' },
            },
          },
        ],
      }),
    );

    expect(draft).toEqual({
      title: 'Data Analyst',
      company: 'Initech',
      location: 'Denver, CO, US',
      workplaceType: 'remote',
      employmentType: 'full_time',
      description: 'Analyse data.',
      postedOn: '2026-02-01',
      deadlineOn: '2026-03-01',
      salaryMin: 70000,
      salaryMax: 90000,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      url: undefined,
    });
  });

  it('decodes entity-escaped descriptions', async () => {
    const draft = await parser.parse(
      page({
        '@type': 'JobPosting',
        title: 'QA',
        description: '&lt;p&gt;Test &amp;amp; ship&lt;/p&gt;',
      }),
    );
    expect(draft?.description).toBe('Test & ship');
  });

  it('returns null when there is no JobPosting', async () => {
    await expect(parser.parse(page({ '@type': 'Organization' }))).resolves.toBeNull();
    await expect(
      parser.parse(fakePage({ html: '<script type="application/ld+json">{oops</script>' })),
    ).resolves.toBeNull();
  });
});
