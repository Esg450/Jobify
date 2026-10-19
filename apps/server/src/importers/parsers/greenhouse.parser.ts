import { salaryFromRanges, type JobDraft, type SalaryRange } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  decodeEntities,
  htmlToMarkdown,
  inferWorkplaceType,
  toCalendarDate,
} from '../normalize.js';

interface GreenhousePayRange {
  /** The employer's name for the range, usually where it applies ("USA - CA, NY"). */
  title?: string;
  min_cents?: number;
  max_cents?: number;
  currency_type?: string;
}

interface GreenhouseJob {
  title?: string;
  company_name?: string;
  location?: { name?: string };
  content?: string;
  absolute_url?: string;
  first_published?: string;
  pay_input_ranges?: GreenhousePayRange[];
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

    const location = cleanText(job.location?.name);
    return {
      title: cleanText(job.title),
      company: cleanText(job.company_name) ?? ids.board,
      location,
      workplaceType: inferWorkplaceType(location),
      // The API returns entity-escaped HTML.
      description: htmlToMarkdown(job.content && decodeEntities(job.content)),
      postedOn: toCalendarDate(job.first_published),
      ...salaryFromRanges(GreenhouseParser.payRanges(job.pay_input_ranges)),
      url: job.absolute_url ?? page.url!.toString(),
    };
  }

  /** Employers list one range per pay transparency region, each with its own title. */
  static payRanges(ranges: GreenhousePayRange[] | undefined): SalaryRange[] {
    const dollars = (cents: number | undefined) => (cents ? Math.round(cents / 100) : undefined);
    return (ranges ?? []).flatMap((range) => {
      const salaryMin = dollars(range.min_cents);
      const salaryMax = dollars(range.max_cents);
      if (!salaryMin && !salaryMax) return [];
      return [
        {
          label: cleanText(range.title),
          salaryMin,
          salaryMax,
          salaryCurrency: range.currency_type,
          salaryPeriod: 'year' as const,
        },
      ];
    });
  }

  static boardAndJob(url: URL): { board: string; jobId: string } | undefined {
    const embedBoard = url.searchParams.get('for');
    const embedToken = url.searchParams.get('token');
    if (embedBoard && embedToken) return { board: embedBoard, jobId: embedToken };

    const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
    return match ? { board: match[1], jobId: match[2] } : undefined;
  }
}
