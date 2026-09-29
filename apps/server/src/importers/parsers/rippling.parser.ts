import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  toCalendarDate,
} from '../normalize.js';

interface RipplingJobPost {
  name?: string;
  companyName?: string;
  description?: { company?: string; role?: string } | string;
  workLocations?: string[];
  employmentType?: { label?: string; id?: string };
  createdOn?: string;
  url?: string;
  payRangeDetails?: {
    minAmount?: number;
    maxAmount?: number;
    currency?: string;
    frequency?: string;
  }[];
  board?: { companyName?: string; title?: string };
}

/**
 * Rippling job boards render on the server and include the posting in the page's Next.js
 * data, so the page itself is the API. Works for fetched and pasted pages alike.
 *
 * Supported URL shape: https://ats.rippling.com/{board}/jobs/{uuid}
 */
export class RipplingParser implements JobParser {
  readonly id = 'rippling';
  readonly site = 'Rippling';

  matches(url: URL | undefined): boolean {
    return url?.hostname === 'ats.rippling.com' && /\/jobs\/[0-9a-f-]{36}/.test(url.pathname);
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const $ = await page.document();
    const data = $('#__NEXT_DATA__').text();
    if (!data) return null;

    let job: RipplingJobPost | undefined;
    try {
      const parsed = JSON.parse(data) as {
        props?: { pageProps?: { apiData?: { jobPost?: RipplingJobPost } } };
      };
      job = parsed.props?.pageProps?.apiData?.jobPost;
    } catch {
      return null;
    }
    if (!job?.name) return null;

    const description =
      typeof job.description === 'string'
        ? job.description
        : [job.description?.company, job.description?.role].filter(Boolean).join('\n');
    const location = cleanText(job.workLocations?.join('; '));
    const pay = job.payRangeDetails?.[0];

    return {
      title: cleanText(job.name),
      company: cleanText(job.companyName ?? job.board?.companyName ?? job.board?.title),
      location,
      workplaceType: inferWorkplaceType(location),
      employmentType: normalizeEmploymentType(job.employmentType?.id ?? job.employmentType?.label),
      description: htmlToMarkdown(description),
      postedOn: toCalendarDate(job.createdOn),
      salaryMin: pay?.minAmount || undefined,
      salaryMax: pay?.maxAmount || undefined,
      salaryCurrency: pay?.currency || undefined,
      salaryPeriod: normalizeSalaryPeriod(pay?.frequency),
      url: job.url ?? page.url!.toString(),
    };
  }
}
