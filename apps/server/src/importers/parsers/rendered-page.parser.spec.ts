import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { RenderedPageParser } from './rendered-page.parser.js';

const paragraphs =
  '<p>You will build the payments platform and own its reliability end to end.</p>'.repeat(3);

// Indeed's job page markup as of September 2026.
const INDEED = `<html><body><div data-testid="viewjob-main-content">
  <div data-testid="desktop-job-header">
    <div data-testid="company-info-title-row"><h5 role="heading" data-testid="vj-job-title">Software Engineer</h5></div>
    <div data-testid="company-info-metadata"><div><div>
      <a aria-label="Ford Motor Company (opens in a new tab)">Ford Motor Company<div></div></a>
      <div><div dir="ltr">·</div><div dir="ltr" aria-label="4.0 out of 5 stars">4.0</div></div>
      <div dir="ltr">Remote</div><div dir="ltr">Remote</div>
    </div></div></div>
  </div>
  <div data-testid="viewjob-job-content">
    <div data-testid="structured-job-summary"><h4>Job details</h4>
      <div dir="ltr">$115,000 - $192,900 a year</div><div dir="ltr">Full-time</div><div dir="ltr">Remote</div>
    </div>
    <h4 data-testid="vj-job-description-heading">Full job description</h4>
    <div class="react-native-html-content simple-job-des"><style>.x{}</style><h3>About the role</h3>${paragraphs}<ul><li>Go</li></ul></div>
  </div>
</div></body></html>`;

const WORKDAY = `<html><head><meta property="og:site_name" content="NVIDIA Careers"></head><body>
  <h2 data-automation-id="jobPostingHeader">Senior Software Engineer, DOCA</h2>
  <div data-automation-id="locations"><dt>locations</dt><dd>Israel, Yokneam</dd><dd>Israel, Tel Aviv</dd></div>
  <div data-automation-id="time"><dt>time type</dt><dd>Full time</dd></div>
  <div data-automation-id="postedOn"><dt>posted on</dt><dd>Posted 3 Days Ago</dd></div>
  <div data-automation-id="jobPostingDescription"><p>NVIDIA is looking for a Senior Software Engineer.</p>${paragraphs}</div>
</body></html>`;

// Glassdoor's job panel markup as of September 2026 (class suffixes change per build).
const GLASSDOOR = `<html><body>
  <div data-test="job-details-header" class="JobDetails_jobDetailsHeader__Hd9M3">
    <div class="EmployerProfile_employerNameHeading__bXBYr"><h4>St, Moritz Enterprises, LLC</h4></div>
    <h1 id="jd-job-title-1010274493134" class="heading_Heading__aomVx">Application Developer Mid-Level</h1>
    <div class="JobDetails_locationAndPay__XGFmY">
      <div data-test="location" class="JobDetails_badgeStyle__xaoxT">Remote</div>
      <div data-test="detailSalary" id="jd-salary-1010274493134">$135K - $165K (Employer provided)</div>
    </div>
  </div>
  <div class="JobDetails_jobDescription__uW_fK"><p>We are seeking a <b>Mid-Level Application Developer</b>.</p><p><b>What You Will Do</b></p>${paragraphs}</div>
</body></html>`;

describe('RenderedPageParser', () => {
  it('reads a Glassdoor job panel', async () => {
    await expect(
      new RenderedPageParser().parse(fakePage({ html: GLASSDOOR })),
    ).resolves.toMatchObject({
      source: 'Glassdoor',
      title: 'Application Developer Mid-Level',
      company: 'St, Moritz Enterprises, LLC',
      location: 'Remote',
      workplaceType: 'remote',
      salaryMin: 135000,
      salaryMax: 165000,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
    });
  });

  const parser = new RenderedPageParser();

  it('reads an Indeed job page', async () => {
    await expect(parser.parse(fakePage({ html: INDEED }))).resolves.toMatchObject({
      source: 'Indeed',
      title: 'Software Engineer',
      company: 'Ford Motor Company',
      location: 'Remote',
      workplaceType: 'remote',
      employmentType: 'full_time',
      salaryMin: 115000,
      salaryMax: 192900,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      description: expect.stringContaining('### About the role'),
    });
  });

  it('reads a Workday page with the company from the site name', async () => {
    await expect(parser.parse(fakePage({ html: WORKDAY }))).resolves.toMatchObject({
      source: 'Workday',
      title: 'Senior Software Engineer, DOCA',
      company: 'NVIDIA',
      location: 'Israel, Yokneam',
      employmentType: 'full_time',
    });
  });

  it('returns null for pages it does not recognise', async () => {
    await expect(
      parser.parse(fakePage({ html: '<h1>Engineer</h1><p>Hello</p>' })),
    ).resolves.toBeNull();
  });
});
