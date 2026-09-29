import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { RipplingParser } from './rippling.parser.js';

const URL_ = 'https://ats.rippling.com/joinroot/jobs/3c8a3de6-12c7-4fa8-aa35-5ba7909145d0';

const NEXT_DATA = {
  props: {
    pageProps: {
      _nextI18Next: {
        initialI18nStore: {
          'en-US': {
            atsFe: {
              aiNoticeModal: {
                title: '{{companyName}} uses AI to analyze applications',
                description: 'AI technology reviews, analyzes and summarizes applications. '.repeat(
                  5,
                ),
              },
            },
          },
        },
      },
      apiData: {
        jobPost: {
          uuid: '3c8a3de6-12c7-4fa8-aa35-5ba7909145d0',
          name: 'Lead Software Engineer, AI Platform',
          description: {
            company: '<p>Root is on a mission to unbreak insurance.</p>',
            role: '<p><b>The Opportunity</b></p><p>Salary Range: $164,200 - $240,000</p><ul><li>Lead delivery</li></ul>',
          },
          workLocations: ['Remote (United States)'],
          employmentType: { label: 'SALARIED_FT', id: 'Salaried, full-time' },
          createdOn: '2026-08-24T07:58:53.136000-07:00',
          url: URL_,
          companyName: 'Root Insurance',
          payRangeDetails: [],
        },
      },
    },
  },
};

const PAGE = `<html><head><title>Lead Software Engineer, AI Platform</title>
<meta property="og:site_name" content="Rippling Recruiting"><link rel="canonical" href="${URL_}"></head>
<body><h2>Lead Software Engineer, AI Platform</h2>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(NEXT_DATA)}</script></body></html>`;

describe('RipplingParser', () => {
  const parser = new RipplingParser();

  it('matches job pages', () => {
    expect(parser.matches(new URL(URL_))).toBe(true);
    expect(parser.matches(new URL('https://ats.rippling.com/joinroot/jobs'))).toBe(false);
  });

  it('reads the posting from the page data', async () => {
    await expect(parser.parse(fakePage({ url: URL_, html: PAGE }))).resolves.toMatchObject({
      title: 'Lead Software Engineer, AI Platform',
      company: 'Root Insurance',
      location: 'Remote (United States)',
      workplaceType: 'remote',
      employmentType: 'full_time',
      postedOn: '2026-08-24',
      description: expect.stringContaining('**The Opportunity**'),
      url: URL_,
    });
  });
});

export { PAGE as RIPPLING_PAGE };
