import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { OracleHcmParser } from './oracle-hcm.parser.js';

const URL_ =
  'https://acme.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/338691';

describe('OracleHcmParser', () => {
  const parser = new OracleHcmParser();

  it('matches job and preview pages', () => {
    expect(parser.matches(new URL(URL_))).toBe(true);
    expect(
      parser.matches(
        new URL(
          'https://acme.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions/preview/12',
        ),
      ),
    ).toBe(true);
    expect(
      parser.matches(
        new URL(
          'https://acme.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions',
        ),
      ),
    ).toBe(false);
  });

  it('reads the requisition from the REST API', async () => {
    const page = fakePage({
      url: URL_,
      responses: {
        'https://acme.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="338691",siteNumber=CX_1':
          {
            items: [
              {
                Title: 'Principal Product Manager',
                PrimaryLocation: 'Nashville, TN, United States',
                secondaryLocations: [{ Name: 'Austin, TX, United States' }],
                ExternalPostedStartDate: '2026-09-25T20:13:34+00:00',
                JobSchedule: 'Full time',
                WorkplaceType: 'Hybrid',
                Organization: 'None',
                ExternalDescriptionStr: '<p>Lead strategy.</p>',
                ExternalResponsibilitiesStr: '<ul><li>Own the roadmap</li></ul>',
              },
            ],
          },
      },
    });

    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Principal Product Manager',
      company: undefined,
      location: 'Nashville, TN, United States; Austin, TX, United States',
      workplaceType: 'hybrid',
      employmentType: 'full_time',
      postedOn: '2026-09-25',
      description: 'Lead strategy.\n\n### Responsibilities\n\n- Own the roadmap',
    });
  });
});
