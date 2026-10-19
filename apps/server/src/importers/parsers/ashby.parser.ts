import { salaryFromRanges, type JobDraft, type SalaryRange } from '../job-draft.js';
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

/** A pay tier, which employers usually define per location ("Zone 1 - SF Bay Area"). */
interface AshbyCompensationTier {
  title?: string;
  components?: AshbyCompensationComponent[];
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
  compensation?: {
    summaryComponents?: AshbyCompensationComponent[];
    compensationTiers?: AshbyCompensationTier[];
  };
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

    return {
      title: cleanText(job.title),
      location: cleanText(job.location),
      workplaceType: inferWorkplaceType(job.workplaceType, job.isRemote ? 'remote' : undefined),
      employmentType: normalizeEmploymentType(job.employmentType),
      description: htmlToMarkdown(job.descriptionHtml),
      postedOn: toCalendarDate(job.publishedAt),
      ...salaryFromRanges(AshbyParser.salaryRanges(job.compensation)),
      url: job.jobUrl ?? page.url!.toString(),
    };
  }

  /**
   * One range per pay tier when the employer defines several; otherwise the summary range,
   * which spans every tier.
   */
  static salaryRanges(compensation: AshbyJob['compensation']): SalaryRange[] {
    const salaryOf = (components: AshbyCompensationComponent[] | undefined) => {
      const salary = components?.find((component) => component.compensationType === 'Salary');
      if (!salary?.minValue && !salary?.maxValue) return undefined;
      return {
        salaryMin: salary.minValue,
        salaryMax: salary.maxValue,
        salaryCurrency: salary.currencyCode,
        salaryPeriod: normalizeSalaryPeriod(salary.interval),
      };
    };

    const tiers = (compensation?.compensationTiers ?? []).flatMap((tier) => {
      const salary = salaryOf(tier.components);
      return salary ? [{ label: cleanText(tier.title), ...salary }] : [];
    });
    if (tiers.length > 1) return tiers;

    const summary = salaryOf(compensation?.summaryComponents);
    return summary ? [summary] : tiers;
  }
}
