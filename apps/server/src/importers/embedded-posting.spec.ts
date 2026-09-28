import { describe, expect, it } from 'vitest';
import { findEmbeddedPosting } from './embedded-posting.js';

const ASHBY_ID = '440fd260-b06a-42e0-b89e-99e966b317dc';

describe('findEmbeddedPosting', () => {
  it('finds an Ashby posting in an iframe', () => {
    const html = `<iframe id="ashby_embed_iframe" src="https://jobs.ashbyhq.com/zafran-security/${ASHBY_ID}?utm_source=x&amp;embed=js"></iframe>`;
    expect(findEmbeddedPosting(html)).toBe(
      `https://jobs.ashbyhq.com/zafran-security/${ASHBY_ID}?utm_source=x&embed=js`,
    );
  });

  it('builds the Ashby posting from ?ashby_jid and the embed script', () => {
    const html = '<script src="https://jobs.ashbyhq.com/acme/embed?version=2"></script>';
    const url = new URL(`https://www.acme.com/careers?ashby_jid=${ASHBY_ID}`);
    expect(findEmbeddedPosting(html, url)).toBe(`https://jobs.ashbyhq.com/acme/${ASHBY_ID}`);
  });

  it('builds the Greenhouse posting from ?gh_jid and the board script', () => {
    const html = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>';
    const url = new URL('https://acme.com/careers?gh_jid=4012345');
    expect(findEmbeddedPosting(html, url)).toBe(
      'https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345',
    );
  });

  it('ignores job board listings and unrelated iframes', () => {
    const html = `
      <iframe src="https://www.youtube.com/embed/abc"></iframe>
      <iframe src="https://jobs.ashbyhq.com/acme"></iframe>
      <script src="https://jobs.ashbyhq.com/acme/embed?version=2"></script>`;
    expect(findEmbeddedPosting(html, new URL('https://acme.com/careers'))).toBeUndefined();
  });
});
