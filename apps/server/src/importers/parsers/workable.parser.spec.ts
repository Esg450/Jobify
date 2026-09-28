import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { WorkableParser } from './workable.parser.js';

describe('WorkableParser', () => {
  const parser = new WorkableParser();

  it('matches job pages only', () => {
    expect(parser.matches(new URL('https://apply.workable.com/acme/j/ABC123DEF/'))).toBe(true);
    expect(parser.matches(new URL('https://apply.workable.com/acme/'))).toBe(false);
  });

  it('reads the posting from the widget API', async () => {
    const page = fakePage({
      url: 'https://apply.workable.com/acme/j/ABC123DEF/',
      responses: {
        'https://apply.workable.com/api/v2/accounts/acme/jobs/ABC123DEF': {
          title: 'Growth Manager',
          location: { city: 'London', region: 'England', country: 'United Kingdom' },
          published: '2026-09-23T00:00:00.000Z',
          type: 'full',
          workplace: 'hybrid',
          remote: false,
          salary_from: 65000,
          salary_to: 80000,
          salary_currency_iso_code: 'GBP',
          description: '<p>The role.</p>',
          requirements: '<ul><li>Marketing</li></ul>',
          benefits: '<p>Pension.</p>',
        },
      },
    });

    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Growth Manager',
      location: 'London, England, United Kingdom',
      workplaceType: 'hybrid',
      employmentType: 'full_time',
      postedOn: '2026-09-23',
      salaryMin: 65000,
      salaryMax: 80000,
      salaryCurrency: 'GBP',
      salaryPeriod: 'year',
      description: 'The role.\n\n### Requirements\n\n- Marketing\n\n### Benefits\n\nPension.',
    });
  });
});
