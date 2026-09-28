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

interface WorkableLocation {
  city?: string;
  region?: string;
  country?: string;
}

interface WorkableJob {
  title?: string;
  location?: WorkableLocation;
  locations?: WorkableLocation[];
  published?: string;
  /** "full", "part", "contract", "temporary", "internship" ... */
  type?: string;
  /** "on_site", "hybrid" or "remote". */
  workplace?: string;
  remote?: boolean;
  salary_from?: number;
  salary_to?: number;
  salary_currency_iso_code?: string;
  salary_frequency?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
}

/**
 * Workable hosted job pages, via the public widget API. The API has no company name; the
 * page title parser fills that in afterwards.
 *
 * Supported URL shape: https://apply.workable.com/{account}/j/{shortcode}/
 */
export class WorkableParser implements JobParser {
  readonly id = 'workable';
  readonly site = 'Workable';

  matches(url: URL | undefined): boolean {
    return (
      url?.hostname === 'apply.workable.com' &&
      /^\/[^/]+\/(?:j|view)\/[A-Za-z0-9]+/.test(url.pathname)
    );
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const [account, , shortcode] = page.url!.pathname.split('/').filter(Boolean);
    const job = await page.fetchJson<WorkableJob>(
      `https://apply.workable.com/api/v2/accounts/${account}/jobs/${shortcode}`,
    );
    if (!job.title) return null;

    const locations = (job.locations?.length ? job.locations : [job.location]).filter(
      Boolean,
    ) as WorkableLocation[];
    const location = cleanText(
      [
        ...new Set(
          locations.map((place) =>
            [place.city, place.region, place.country].filter(Boolean).join(', '),
          ),
        ),
      ]
        .filter(Boolean)
        .join('; '),
    );
    const sections = [
      job.description,
      job.requirements && `<h3>Requirements</h3>${job.requirements}`,
      job.benefits && `<h3>Benefits</h3>${job.benefits}`,
    ];

    return {
      title: cleanText(job.title),
      location,
      workplaceType: job.remote ? 'remote' : inferWorkplaceType(job.workplace?.replace('_', '-')),
      employmentType: normalizeEmploymentType(WorkableParser.employment(job.type)),
      description: htmlToMarkdown(sections.filter(Boolean).join('\n')),
      postedOn: toCalendarDate(job.published),
      salaryMin: job.salary_from || undefined,
      salaryMax: job.salary_to || undefined,
      salaryCurrency: job.salary_currency_iso_code || undefined,
      salaryPeriod:
        normalizeSalaryPeriod(job.salary_frequency) ?? (job.salary_from ? 'year' : undefined),
      url: `https://apply.workable.com/${account}/j/${shortcode}/`,
    };
  }

  private static employment(type: string | undefined): string | undefined {
    return { full: 'full-time', part: 'part-time' }[type ?? ''] ?? type;
  }
}
