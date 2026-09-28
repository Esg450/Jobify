import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  decodeEntities,
  htmlToMarkdown,
  inferWorkplaceType,
  toCalendarDate,
} from '../normalize.js';

interface GreenhouseJob {
  title?: string;
  company_name?: string;
  location?: { name?: string };
  content?: string;
  absolute_url?: string;
  first_published?: string;
  pay_input_ranges?: { min_cents?: number; max_cents?: number; currency_type?: string }[];
}

/**
 * Greenhouse hosted job boards, via the public Job Board API.
 *
 * Supported URL shapes:
 *   https://boards.greenhouse.io/{board}/jobs/{id}
 *   https://job-boards.greenhouse.io/{board}/jobs/{id}
 *   https://boards.greenhouse.io/embed/job_app?for={board}&token={id}
 */
export class GreenhouseParser implements JobParser {
  readonly id = 'greenhouse';
  readonly site = 'Greenhouse';

  matches(url: URL | undefined): boolean {
    return !!url && /(^|\.)greenhouse\.io$/.test(url.hostname);
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const ids = page.url && GreenhouseParser.boardAndJob(page.url);
    if (!ids) return null;

    const job = await page.fetchJson<GreenhouseJob>(
      `https://boards-api.greenhouse.io/v1/boards/${ids.board}/jobs/${ids.jobId}?pay_transparency=true`,
    );
    if (!job.title) return null;

    const pay = job.pay_input_ranges?.[0];
    const location = cleanText(job.location?.name);
    return {
      title: cleanText(job.title),
      company: cleanText(job.company_name) ?? ids.board,
      location,
      workplaceType: inferWorkplaceType(location),
      // The API returns entity-escaped HTML.
      description: htmlToMarkdown(job.content && decodeEntities(job.content)),
      postedOn: toCalendarDate(job.first_published),
      salaryMin: pay?.min_cents ? Math.round(pay.min_cents / 100) : undefined,
      salaryMax: pay?.max_cents ? Math.round(pay.max_cents / 100) : undefined,
      salaryCurrency: pay?.currency_type,
      salaryPeriod: pay ? 'year' : undefined,
      url: job.absolute_url ?? page.url!.toString(),
    };
  }

  static boardAndJob(url: URL): { board: string; jobId: string } | undefined {
    const embedBoard = url.searchParams.get('for');
    const embedToken = url.searchParams.get('token');
    if (embedBoard && embedToken) return { board: embedBoard, jobId: embedToken };

    const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
    return match ? { board: match[1], jobId: match[2] } : undefined;
  }
}
