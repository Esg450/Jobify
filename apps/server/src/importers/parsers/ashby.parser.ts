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

interface AshbyCompensationComponent {
  compensationType?: string;
  interval?: string;
  currencyCode?: string;
  minValue?: number;
  maxValue?: number;
}

interface AshbyJob {
  id: string;
  title?: string;
  location?: string;
  workplaceType?: string;
  isRemote?: boolean;
  employmentType?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  jobUrl?: string;
  compensation?: { summaryComponents?: AshbyCompensationComponent[] };
}

/**
 * Ashby hosted job boards, via the public Posting API.
 *
 * The API does not include the company's display name, so it is left for the
 * structured data on the posting page to fill in.
 *
 * Supported URL shape: https://jobs.ashbyhq.com/{organization}/{jobId}
 */
export class AshbyParser implements JobParser {
  readonly id = 'ashby';
  readonly site = 'Ashby';

  matches(url: URL | undefined): boolean {
    return url?.hostname === 'jobs.ashbyhq.com';
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const [organization, jobId] = page.url!.pathname.split('/').filter(Boolean);
    if (!organization || !jobId) return null;

    const board = await page.fetchJson<{ jobs?: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${organization}?includeCompensation=true`,
    );
    const job = board.jobs?.find((candidate) => candidate.id === jobId);
    if (!job?.title) return null;

    const salary = job.compensation?.summaryComponents?.find(
      (component) => component.compensationType === 'Salary',
    );

    return {
      title: cleanText(job.title),
      location: cleanText(job.location),
      workplaceType: inferWorkplaceType(job.workplaceType, job.isRemote ? 'remote' : undefined),
      employmentType: normalizeEmploymentType(job.employmentType),
      description: htmlToMarkdown(job.descriptionHtml),
      postedOn: toCalendarDate(job.publishedAt),
      salaryMin: salary?.minValue,
      salaryMax: salary?.maxValue,
      salaryCurrency: salary?.currencyCode,
      salaryPeriod: normalizeSalaryPeriod(salary?.interval),
      url: job.jobUrl ?? page.url!.toString(),
    };
  }
}
