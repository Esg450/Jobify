import { describe, expect, it } from 'vitest';
import type { JobSpyPost } from './jobspy-client.js';
import { postToDraft, siteLabel } from './jobspy-mapping.js';

const post: JobSpyPost = {
  id: 'in-123',
  site: 'indeed',
  job_url: 'https://www.indeed.com/viewjob?jk=123',
  title: '  Senior Platform Engineer ',
  company: 'Acme Corp',
  location: 'Austin, TX, US',
  date_posted: '2026-10-01',
  job_type: 'fulltime',
  is_remote: false,
  interval: 'yearly',
  min_amount: 150000,
  max_amount: 180000.5,
  currency: 'usd',
  description: '# About\n\nBuild the platform.\n',
};

describe('postToDraft', () => {
  it('maps a JobSpy row onto the job draft fields', () => {
    expect(postToDraft(post)).toEqual({
      title: 'Senior Platform Engineer',
      company: 'Acme Corp',
      location: 'Austin, TX, US',
      employmentType: 'full_time',
      salaryMin: 150000,
      salaryMax: 180001,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      url: 'https://www.indeed.com/viewjob?jk=123',
      source: 'Indeed',
      description: '# About\n\nBuild the platform.',
      postedOn: '2026-10-01',
    });
  });

  it('uses the remote flag, then the location and title, for the workplace type', () => {
    expect(postToDraft({ ...post, is_remote: true }).workplaceType).toBe('remote');
    expect(postToDraft({ ...post, location: 'Hybrid - London' }).workplaceType).toBe('hybrid');
    expect(postToDraft(post).workplaceType).toBeUndefined();
  });

  it('leaves out columns the board did not fill', () => {
    const draft = postToDraft({
      ...post,
      location: null,
      job_type: null,
      interval: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      description: '   ',
      date_posted: null,
    });
    expect(draft).toEqual({
      title: 'Senior Platform Engineer',
      company: 'Acme Corp',
      url: 'https://www.indeed.com/viewjob?jk=123',
      source: 'Indeed',
    });
  });

  it('understands the other employment types and pay intervals', () => {
    expect(postToDraft({ ...post, job_type: 'parttime' }).employmentType).toBe('part_time');
    expect(postToDraft({ ...post, job_type: 'contract' }).employmentType).toBe('contract');
    expect(postToDraft({ ...post, job_type: 'internship' }).employmentType).toBe('internship');
    expect(postToDraft({ ...post, interval: 'hourly' }).salaryPeriod).toBe('hour');
    expect(postToDraft({ ...post, interval: 'monthly' }).salaryPeriod).toBe('month');
  });
});

describe('siteLabel', () => {
  it('names the boards Jobify knows and passes others through', () => {
    expect(siteLabel('zip_recruiter')).toBe('ZipRecruiter');
    expect(siteLabel('linkedin')).toBe('LinkedIn');
    expect(siteLabel('monster')).toBe('monster');
    expect(siteLabel(null)).toBeUndefined();
  });
});
