import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import { cleanText, htmlToMarkdown } from '../normalize.js';

/**
 * Last-resort parser that reads OpenGraph tags and the page's main content. Results are
 * rough, so it only fills fields that more specific parsers could not.
 */
export class MetaTagsParser implements JobParser {
  readonly id = 'meta-tags';
  readonly fallback = true;

  matches(): boolean {
    return true;
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const $ = await page.document();
    const meta = (name: string) =>
      cleanText($(`meta[property="${name}"], meta[name="${name}"]`).attr('content'));

    const title =
      meta('og:title') ?? cleanText($('h1').first().text()) ?? cleanText($('title').text());
    if (!title) return null;

    const main = $('main, [role="main"], article').first();
    return {
      title,
      company: meta('og:site_name'),
      description: htmlToMarkdown(main.html()) ?? meta('og:description') ?? meta('description'),
      url: meta('og:url'),
    };
  }
}
