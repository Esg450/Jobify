import * as cheerio from 'cheerio';
import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
} from '../normalize.js';

/**
 * LinkedIn job postings. Logged-out job pages are served from a "guest" endpoint that
 * returns the posting as an HTML fragment, which avoids the login wall.
 *
 * Supported URL shapes:
 *   https://www.linkedin.com/jobs/view/{id}
 *   https://www.linkedin.com/jobs/view/{slug}-{id}
 *   https://www.linkedin.com/jobs/search/?currentJobId={id}
 */
export class LinkedInParser implements JobParser {
  readonly id = 'linkedin';
  readonly site = 'LinkedIn';

  matches(url: URL | undefined): boolean {
    return !!url && /(^|\.)linkedin\.com$/.test(url.hostname);
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const jobId = LinkedInParser.jobId(page.url!);
    if (!jobId) return null;

    const html = await page.fetchText(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
    );
    const draft = LinkedInParser.parseHtml(html);
    return draft && { ...draft, url: `https://www.linkedin.com/jobs/view/${jobId}` };
  }

  static jobId(url: URL): string | undefined {
    return (
      url.searchParams.get('currentJobId') ??
      url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] ??
      undefined
    );
  }

  static parseHtml(html: string): JobDraft | null {
    const $ = cheerio.load(html);
    const title = cleanText($('.top-card-layout__title, .topcard__title').first().text());
    if (!title) return null;

    const criteria = new Map<string, string>();
    $('.description__job-criteria-item').each((_, item) => {
      const label = cleanText($(item).find('.description__job-criteria-subheader').text());
      const value = cleanText($(item).find('.description__job-criteria-text').text());
      if (label && value) criteria.set(label.toLowerCase(), value);
    });

    const location = cleanText($('.topcard__flavor--bullet').first().text());
    return {
      title,
      company: cleanText($('.topcard__org-name-link, .topcard__flavor').first().text()),
      location,
      workplaceType: inferWorkplaceType(location, title),
      employmentType: normalizeEmploymentType(criteria.get('employment type')),
      description: htmlToMarkdown(
        $('.show-more-less-html__markup, .description__text').first().html(),
      ),
    };
  }
}
