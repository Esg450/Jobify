import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { WorkdayParser } from './workday.parser.js';

describe('WorkdayParser', () => {
  const parser = new WorkdayParser();

  it('builds the API URL for myworkdayjobs.com', () => {
    const url = new URL(
      'https://acme.wd5.myworkdayjobs.com/en-US/External/job/Remote-USA/Engineer_R123',
    );
    expect(parser.matches(url)).toBe(true);
    expect(WorkdayParser.apiUrl(url)).toBe(
      'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Remote-USA/Engineer_R123',
    );
  });

  it('builds the API URL for myworkdaysite.com', () => {
    const url = new URL(
      'https://wd1.myworkdaysite.com/en-US/recruiting/acme/Careers/job/Berlin/Engineer_R9',
    );
    expect(WorkdayParser.apiUrl(url)).toBe(
      'https://wd1.myworkdaysite.com/wday/cxs/acme/Careers/job/Berlin/Engineer_R9',
    );
  });

  it('ignores Workday pages that are not postings', () => {
    expect(parser.matches(new URL('https://acme.wd5.myworkdayjobs.com/External'))).toBe(false);
  });

  it('parses a posting', async () => {
    const page = fakePage({
      url: 'https://acme.wd5.myworkdayjobs.com/External/job/Remote-USA/Engineer_R123',
      responses: {
        'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Remote-USA/Engineer_R123': {
          jobPostingInfo: {
            title: 'Engineer',
            jobDescription: '<p>Build <b>things</b>.</p>',
            location: 'Remote USA',
            timeType: 'Full time',
            startDate: '2026-09-01',
          },
          hiringOrganization: { name: 'Acme Corp' },
        },
      },
    });

    await expect(parser.parse(page)).resolves.toEqual({
      title: 'Engineer',
      company: 'Acme Corp',
      location: 'Remote USA',
      workplaceType: 'remote',
      employmentType: 'full_time',
      description: 'Build **things**.',
      postedOn: '2026-09-01',
      url: 'https://acme.wd5.myworkdayjobs.com/External/job/Remote-USA/Engineer_R123',
    });
  });
});
