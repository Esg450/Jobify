import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { SmartRecruitersParser } from './smartrecruiters.parser.js';

describe('SmartRecruitersParser', () => {
  const parser = new SmartRecruitersParser();

  it('parses a posting from its numeric id', async () => {
    const page = fakePage({
      url: 'https://jobs.smartrecruiters.com/Acme/744000012345678-data-engineer',
      responses: {
        'https://api.smartrecruiters.com/v1/companies/Acme/postings/744000012345678': {
          name: 'Data Engineer',
          company: { name: 'Acme Inc.' },
          location: { city: 'Lisbon', country: 'pt', hybrid: true },
          typeOfEmployment: { label: 'Full-time' },
          releasedDate: '2026-07-07T10:00:00.000Z',
          jobAd: {
            sections: {
              jobDescription: { title: 'Job Description', text: '<p>Build pipelines.</p>' },
              qualifications: { title: 'Qualifications', text: '<ul><li>SQL</li></ul>' },
            },
          },
        },
      },
    });

    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Data Engineer',
      company: 'Acme Inc.',
      location: 'Lisbon, pt',
      workplaceType: 'hybrid',
      employmentType: 'full_time',
      description: '## Job Description\n\nBuild pipelines.\n\n## Qualifications\n\n- SQL',
      postedOn: '2026-07-07',
    });
  });
});
