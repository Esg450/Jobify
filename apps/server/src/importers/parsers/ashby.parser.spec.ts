import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { AshbyParser } from './ashby.parser.js';

const BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true';

describe('AshbyParser', () => {
  const parser = new AshbyParser();

  it('finds the posting on the job board', async () => {
    const page = fakePage({
      url: 'https://jobs.ashbyhq.com/acme/job-2',
      responses: {
        [BOARD_URL]: {
          jobs: [
            { id: 'job-1', title: 'Other role' },
            {
              id: 'job-2',
              title: 'Product Designer',
              location: 'Toronto',
              workplaceType: 'Remote',
              employmentType: 'FullTime',
              descriptionHtml: '<p>Design things.</p>',
              publishedAt: '2026-06-01T09:00:00.000+00:00',
              compensation: {
                summaryComponents: [
                  { compensationType: 'Equity' },
                  {
                    compensationType: 'Salary',
                    interval: '1 YEAR',
                    currencyCode: 'CAD',
                    minValue: 110000,
                    maxValue: 130000,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Product Designer',
      location: 'Toronto',
      workplaceType: 'remote',
      employmentType: 'full_time',
      description: 'Design things.',
      postedOn: '2026-06-01',
      salaryMin: 110000,
      salaryMax: 130000,
      salaryCurrency: 'CAD',
      salaryPeriod: 'year',
    });
  });

  it('offers one range per pay tier when the employer defines several', async () => {
    const salary = (minValue: number, maxValue: number) => ({
      compensationType: 'Salary',
      interval: '1 YEAR',
      currencyCode: 'USD',
      minValue,
      maxValue,
    });
    const page = fakePage({
      url: 'https://jobs.ashbyhq.com/acme/job-1',
      responses: {
        [BOARD_URL]: {
          jobs: [
            {
              id: 'job-1',
              title: 'Engineer',
              compensation: {
                summaryComponents: [salary(150000, 220000)],
                compensationTiers: [
                  { title: 'Zone 1 - SF Bay Area', components: [salary(180000, 220000)] },
                  {
                    title: 'Zone 2',
                    components: [{ compensationType: 'Equity' }, salary(150000, 190000)],
                  },
                  { title: 'No pay listed', components: [] },
                ],
              },
            },
          ],
        },
      },
    });

    const draft = await parser.parse(page);
    expect(draft?.salaryMin).toBeUndefined();
    expect(draft?.salaryRanges).toEqual([
      {
        label: 'Zone 1 - SF Bay Area',
        salaryMin: 180000,
        salaryMax: 220000,
        salaryCurrency: 'USD',
        salaryPeriod: 'year',
      },
      {
        label: 'Zone 2',
        salaryMin: 150000,
        salaryMax: 190000,
        salaryCurrency: 'USD',
        salaryPeriod: 'year',
      },
    ]);
  });

  it('returns null when the posting is no longer listed', async () => {
    const page = fakePage({
      url: 'https://jobs.ashbyhq.com/acme/gone',
      responses: { [BOARD_URL]: { jobs: [] } },
    });
    await expect(parser.parse(page)).resolves.toBeNull();
  });
});
