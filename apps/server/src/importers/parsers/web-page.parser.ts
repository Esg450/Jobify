import * as cheerio from 'cheerio';
import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import { cleanText, htmlToMarkdown, toCalendarDate } from '../normalize.js';
import {
  findDescriptionBlock,
  findLocation,
  findPostedDate,
  removePageFurniture,
} from '../page-signals.js';
import {
  cleanCompanyName,
  companyFromListingTitle,
  isListingTitle,
  looksLikeJobTitle,
  splitPageTitle,
} from '../text-signals.js';

/** Hosts whose name says nothing about the employer. */
const GENERIC_HOSTS =
  /(?:greenhouse|lever|ashbyhq|myworkdayjobs|myworkdaysite|workable|smartrecruiters|icims|jobvite|bamboohr|recruitee|teamtailor|personio|breezy|rippling|linkedin|indeed|glassdoor|ziprecruiter|monster|dice|wellfound|oraclecloud|successfactors|taleo|eightfold|phenom)\./i;

const MULTI_PART_TLD = /\.(?:co|com|org|net|ac|gov|edu)\.[a-z]{2}$/i;

/**
 * Last-resort parser for any web page: works from the page title, OpenGraph tags and the
 * block of text that looks most like a job description. Its output is a best guess, so it
 * is marked as a fallback and AI extraction may replace it.
 */
export class WebPageParser implements JobParser {
  readonly id = 'web-page';
  readonly fallback = true;

  matches(): boolean {
    return true;
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    // Work on a private copy: the description search strips parts of the document.
    const $ = cheerio.load(await page.html());
    const meta = (name: string) =>
      cleanText($(`meta[property="${name}"], meta[name="${name}"]`).first().attr('content'));

    const siteName = cleanCompanyName(meta('og:site_name'));
    const pageTitle = meta('og:title') ?? meta('twitter:title') ?? cleanText($('title').text());
    const heading = this.headingTitle($);

    // A careers page title ("Acme Careers") only hides a posting when the heading is one;
    // single-page apps often leave the page title alone and put the job in the h1.
    let title: string | undefined;
    let titleCompany: string | undefined;
    if (isListingTitle(pageTitle)) {
      title = looksLikeJobTitle(heading) ? heading : undefined;
      titleCompany = companyFromListingTitle(pageTitle);
    } else {
      const parts = splitPageTitle(pageTitle, siteName);
      title =
        heading && (!parts || parts.title.includes(heading) || heading.includes(parts.title))
          ? heading
          : parts?.title;
      titleCompany = parts?.company;
    }
    if (!title) return null;

    const postedOn = toCalendarDate(findPostedDate($));
    const location = findLocation($);

    removePageFurniture($);
    const block = findDescriptionBlock($);
    if (block) {
      // The title and the location are captured separately; drop them from the body text.
      $(block).find('h1').remove();
    }
    const description =
      htmlToMarkdown(block ? $.html(block) : undefined) ??
      meta('og:description') ??
      meta('description');

    return {
      title,
      company: siteName ?? titleCompany ?? WebPageParser.companyFromHost(page.url),
      location,
      description,
      postedOn,
      url: meta('og:url') ?? $('link[rel="canonical"]').attr('href'),
    };
  }

  /** The first h1 that reads like a job title rather than "Job details" or a site name. */
  private headingTitle($: cheerio.CheerioAPI): string | undefined {
    for (const heading of $('h1').toArray()) {
      const text = cleanText($(heading).text());
      if (text && text.length >= 3 && text.length <= 150 && !isListingTitle(text)) return text;
    }
    return undefined;
  }

  /** "Acme" from careers.acme.com, as a last resort. */
  static companyFromHost(url: URL | undefined): string | undefined {
    if (
      !url ||
      GENERIC_HOSTS.test(url.hostname) ||
      /^(?:\d+\.){3}\d+$|localhost/.test(url.hostname)
    ) {
      return undefined;
    }
    const parts = url.hostname.replace(/^www\./, '').split('.');
    const labelIndex = MULTI_PART_TLD.test(url.hostname) ? parts.length - 3 : parts.length - 2;
    const label = parts[labelIndex];
    if (!label || label.length < 3) return undefined;
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
