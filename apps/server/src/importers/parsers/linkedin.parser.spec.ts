import { describe, expect, it } from 'vitest';
import { LinkedInParser } from './linkedin.parser.js';

const GUEST_HTML = `
<section class="top-card-layout">
  <h2 class="top-card-layout__title">Senior Backend Engineer</h2>
  <a class="topcard__org-name-link">  Globex  </a>
  <span class="topcard__flavor topcard__flavor--bullet">Austin, TX (Hybrid)</span>
</section>
<div class="show-more-less-html__markup"><p>Own our <strong>payments</strong> platform.</p></div>
<ul>
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Seniority level</h3>
    <span class="description__job-criteria-text">Mid-Senior level</span>
  </li>
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Employment type</h3>
    <span class="description__job-criteria-text">Contract</span>
  </li>
</ul>`;

describe('LinkedInParser', () => {
  it.each([
    ['https://www.linkedin.com/jobs/view/4012345678/', '4012345678'],
    ['https://www.linkedin.com/jobs/view/senior-engineer-at-globex-4012345678', '4012345678'],
    ['https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=x', '4012345678'],
    ['https://www.linkedin.com/feed/', undefined],
  ])('finds the job id in %s', (url, expected) => {
    expect(LinkedInParser.jobId(new URL(url))).toBe(expected);
  });

  it('parses the guest job posting markup', () => {
    expect(LinkedInParser.parseHtml(GUEST_HTML)).toEqual({
      title: 'Senior Backend Engineer',
      company: 'Globex',
      location: 'Austin, TX (Hybrid)',
      workplaceType: 'hybrid',
      employmentType: 'contract',
      description: 'Own our **payments** platform.',
    });
  });

  it('returns null for unrelated pages', () => {
    expect(LinkedInParser.parseHtml('<p>Sign in</p>')).toBeNull();
  });
});
