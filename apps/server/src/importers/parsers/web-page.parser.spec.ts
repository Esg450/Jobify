import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { WebPageParser } from './web-page.parser.js';

const body = `<main><div class="posting">
  <h2>About the role</h2><p>${'You will build the payments platform. '.repeat(15)}</p>
  <h2>Requirements</h2><ul><li>Go</li><li>Kubernetes</li></ul>
</div></main>`;

describe('WebPageParser', () => {
  const parser = new WebPageParser();

  it('cleans the page title and reads the company from the site name', async () => {
    const page = fakePage({
      url: 'https://www.amazon.jobs/en/jobs/1',
      html: `<html><head><title>Data Analyst - Job ID: 12345 | Amazon.jobs</title>
        <meta property="og:site_name" content="Amazon.jobs"></head><body>
        <nav><a href="/locations">Locations</a></nav><h1>Data Analyst</h1>
        <div class="association location-icon"><ul><li>USA, WA, Seattle</li></ul></div>${body}</body></html>`,
    });
    await expect(parser.parse(page)).resolves.toMatchObject({
      title: 'Data Analyst',
      company: 'Amazon',
      location: 'USA, WA, Seattle',
      description: expect.stringContaining('## Requirements'),
    });
  });

  it('falls back to the host for the company', async () => {
    const page = fakePage({
      url: 'https://careers.zafran.io/positions/12',
      html: `<html><head><title>Senior DevOps Engineer</title></head><body><h1>Senior DevOps Engineer</h1>${body}</body></html>`,
    });
    await expect(parser.parse(page)).resolves.toMatchObject({ company: 'Zafran' });
  });

  it('ignores careers pages unless the heading is a job title', async () => {
    const careers = `<html><head><title>Zafran Careers</title></head><body><h1>Come Build With Us</h1>${body}</body></html>`;
    await expect(parser.parse(fakePage({ html: careers }))).resolves.toBeNull();

    const spa = `<html><head><title>Careers | Acme</title></head><body><h1>Senior Engineer</h1>${body}</body></html>`;
    await expect(parser.parse(fakePage({ html: spa }))).resolves.toMatchObject({
      title: 'Senior Engineer',
      company: 'Acme',
    });
  });
});
