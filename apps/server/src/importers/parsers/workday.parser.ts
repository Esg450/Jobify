import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  toCalendarDate,
} from '../normalize.js';

interface WorkdayResponse {
  jobPostingInfo?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    timeType?: string;
    remoteType?: string;
    startDate?: string;
    externalUrl?: string;
  };
  hiringOrganization?: { name?: string };
}

/**
 * Workday career sites render client-side, but expose the posting through a JSON
 * endpoint under /wday/cxs/{tenant}/{site}/job/...
 *
 * Supported URL shapes:
 *   https://{tenant}.wd5.myworkdayjobs.com/{locale?}/{site}/job/{location}/{slug}
 *   https://wd1.myworkdaysite.com/{locale?}/recruiting/{tenant}/{site}/job/{location}/{slug}
 */
export class WorkdayParser implements JobParser {
  readonly id = 'workday';
  readonly site = 'Workday';

  matches(url: URL | undefined): boolean {
    return (
      !!url &&
      /\.(myworkdayjobs|myworkdaysite)\.com$/.test(url.hostname) &&
      url.pathname.includes('/job/')
    );
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const apiUrl = page.url && WorkdayParser.apiUrl(page.url);
    if (!apiUrl) return null;

    const { jobPostingInfo: info, hiringOrganization } =
      await page.fetchJson<WorkdayResponse>(apiUrl);
    if (!info?.title) return null;

    const tenant = WorkdayParser.tenant(page.url!);
    return {
      title: cleanText(info.title),
      company: cleanText(hiringOrganization?.name) ?? tenant,
      location: cleanText(
        [info.location, ...(info.additionalLocations ?? [])].filter(Boolean).join('; '),
      ),
      workplaceType: inferWorkplaceType(info.remoteType, info.location),
      employmentType: normalizeEmploymentType(info.timeType),
      description: htmlToMarkdown(info.jobDescription),
      postedOn: toCalendarDate(info.startDate),
      url: info.externalUrl ?? page.url!.toString(),
    };
  }

  static apiUrl(url: URL): string | undefined {
    const segments = url.pathname.split('/').filter(Boolean);
    const jobIndex = segments.indexOf('job');
    if (jobIndex < 1) return undefined;

    const site = segments[jobIndex - 1];
    const tenant = WorkdayParser.tenant(url);
    if (!tenant) return undefined;

    const jobPath = segments.slice(jobIndex).join('/');
    return `${url.origin}/wday/cxs/${tenant}/${site}/${jobPath}`;
  }

  private static tenant(url: URL): string | undefined {
    if (url.hostname.endsWith('.myworkdayjobs.com')) return url.hostname.split('.')[0];
    // myworkdaysite.com puts the tenant after /recruiting/.
    const segments = url.pathname.split('/').filter(Boolean);
    const recruitingIndex = segments.indexOf('recruiting');
    return recruitingIndex >= 0 ? segments[recruitingIndex + 1] : undefined;
  }
}
