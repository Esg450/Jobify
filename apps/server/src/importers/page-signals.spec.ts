import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import {
  findDescriptionBlock,
  findLocation,
  looksLikeJobListing,
  removePageFurniture,
  urlFromHtml,
} from './page-signals.js';

const PAGE = `<html><body>
<nav><a href="/jobs">Jobs</a><a href="/locations">Locations</a></nav>
<header><h1>Platform Engineer</h1><div class="job-location">Austin, TX</div></header>
<div class="sidebar"><a href="/jobs/1">Similar job one</a><a href="/jobs/2">Similar job two</a></div>
<main><div class="wrapper"><div class="content">
  <h2>About the role</h2><p>${'You will build things. '.repeat(20)}</p>
  <h2>Responsibilities</h2><ul><li>Ship</li><li>Learn</li></ul>
  <h2>Requirements</h2><ul><li>5 years</li></ul>
</div></div></main>
<div class="cookie-banner">We use cookies. ${'Accept all cookies. '.repeat(30)}</div>
<footer>© Acme</footer>
</body></html>`;

describe('page signals', () => {
  it('finds the location label before furniture is removed', () => {
    expect(findLocation(cheerio.load(PAGE))).toBe('Austin, TX');
  });

  it('reads a location from a small element when nothing is labelled', () => {
    const $ = cheerio.load(
      '<body><h1>Engineer</h1><p><span>San Francisco, CA, USA</span><span>; +3 more</span></p></body>',
    );
    expect(findLocation($)).toBe('San Francisco, CA, USA');
  });

  it('picks the tightest block with the description headings', () => {
    const $ = cheerio.load(PAGE);
    removePageFurniture($);
    const block = findDescriptionBlock($);
    expect($(block).attr('class')).toBe('content');
    expect($.html()).not.toContain('cookies');
  });

  it('spots job listings by their many job links', () => {
    const links = Array.from(
      { length: 10 },
      (_, i) => `<a href="/jobs/${1000 + i}/engineer">Job ${i}</a>`,
    ).join('');
    expect(
      looksLikeJobListing(
        cheerio.load(`<body>${links}</body>`),
        new URL('https://acme.com/careers'),
      ),
    ).toBe(true);
    expect(looksLikeJobListing(cheerio.load(PAGE), new URL('https://acme.com/jobs/1'))).toBe(false);
  });

  it('reads the page address from pasted source', () => {
    const html = '<link rel="canonical" href="https://jobs.example.com/job/1">';
    expect(urlFromHtml(html, cheerio.load(html))?.toString()).toBe(
      'https://jobs.example.com/job/1',
    );
    expect(urlFromHtml('<p>hi</p>', cheerio.load('<p>hi</p>'))).toBeUndefined();
  });

  it('works out the posting id of a signed-in LinkedIn page', () => {
    const html = `<a href="https://www.linkedin.com/jobs/view/111111/">similar</a>
      <a href="https://www.linkedin.com/jobs/view/4419969671/">share</a>
      <a href="https://www.linkedin.com/jobs/view/4419969671/apply">apply</a>`;
    expect(urlFromHtml(html, cheerio.load(html))?.toString()).toBe(
      'https://www.linkedin.com/jobs/view/4419969671',
    );
  });
});
