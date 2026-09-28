import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  toCalendarDate,
} from '../normalize.js';

interface OracleRequisition {
  Title?: string;
  PrimaryLocation?: string;
  secondaryLocations?: { Name?: string }[];
  ExternalPostedStartDate?: string;
  ExternalPostedEndDate?: string;
  JobSchedule?: string;
  WorkplaceType?: string;
  Organization?: string;
  ShortDescriptionStr?: string;
  ExternalDescriptionStr?: string;
  ExternalResponsibilitiesStr?: string;
  ExternalQualificationsStr?: string;
}

/**
 * Oracle Cloud HCM career sites (used by many large employers). Pages render client-side,
 * but the same REST API the page calls is public.
 *
 * Supported URL shapes:
 *   https://{tenant}.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/{lang}/sites/{site}/job/{id}
 *   https://{tenant}.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/{lang}/sites/{site}/requisitions/preview/{id}
 */
export class OracleHcmParser implements JobParser {
  readonly id = 'oracle-hcm';
  readonly site = 'Oracle';

  matches(url: URL | undefined): boolean {
    return (
      !!url && /\.oraclecloud\.com$/.test(url.hostname) && OracleHcmParser.ids(url) !== undefined
    );
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const ids = OracleHcmParser.ids(page.url!)!;
    const { items } = await page.fetchJson<{ items?: OracleRequisition[] }>(
      `${page.url!.origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="${ids.job}",siteNumber=${ids.site}`,
    );
    const job = items?.[0];
    if (!job?.Title) return null;

    const locations = [
      job.PrimaryLocation,
      ...(job.secondaryLocations ?? []).map((place) => place.Name),
    ];
    const sections = [
      job.ExternalDescriptionStr,
      job.ExternalResponsibilitiesStr &&
        `<h3>Responsibilities</h3>${job.ExternalResponsibilitiesStr}`,
      job.ExternalQualificationsStr && `<h3>Qualifications</h3>${job.ExternalQualificationsStr}`,
    ];

    return {
      title: cleanText(job.Title),
      company: cleanText(job.Organization === 'None' ? undefined : job.Organization),
      location: cleanText(locations.filter(Boolean).join('; ')),
      workplaceType: inferWorkplaceType(job.WorkplaceType, job.PrimaryLocation),
      employmentType: normalizeEmploymentType(job.JobSchedule),
      description:
        htmlToMarkdown(sections.filter(Boolean).join('\n')) ?? cleanText(job.ShortDescriptionStr),
      postedOn: toCalendarDate(job.ExternalPostedStartDate),
      deadlineOn: toCalendarDate(job.ExternalPostedEndDate),
      url: page.url!.toString(),
    };
  }

  static ids(url: URL): { site: string; job: string } | undefined {
    const match =
      /\/CandidateExperience\/[^/]+\/sites\/([^/]+)\/(?:job|requisitions\/preview)\/(\d+)/i.exec(
        url.pathname,
      );
    return match ? { site: match[1], job: match[2] } : undefined;
  }
}
