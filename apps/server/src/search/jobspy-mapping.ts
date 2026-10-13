import type { JobDraft } from '../importers/job-draft.js';
import {
  cleanText,
  inferWorkplaceType,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  toCalendarDate,
  toWholeNumber,
} from '../importers/normalize.js';
import type { JobSpyPost } from './jobspy-client.js';
import { SEARCH_SITES, type SearchSite } from './search.constants.js';

/** The display name for one of JobSpy's site ids, falling back to the id itself. */
export function siteLabel(site: string | null | undefined): string | undefined {
  if (!site) return undefined;
  return SEARCH_SITES[site as SearchSite] ?? site;
}

/** Turns a JobSpy result into the draft the Add job page expects. */
export function postToDraft(post: JobSpyPost): JobDraft {
  const title = cleanText(post.title);
  const location = cleanText(post.location);
  const description = post.description?.trim() || undefined;
  const draft: JobDraft = {
    title,
    company: cleanText(post.company),
    location,
    workplaceType: post.is_remote ? 'remote' : inferWorkplaceType(location, title),
    employmentType: normalizeEmploymentType(post.job_type),
    salaryMin: toWholeNumber(post.min_amount),
    salaryMax: toWholeNumber(post.max_amount),
    salaryCurrency: cleanText(post.currency)?.toUpperCase(),
    salaryPeriod: normalizeSalaryPeriod(post.interval),
    url: post.job_url?.trim() || undefined,
    source: siteLabel(post.site),
    description,
    postedOn: toCalendarDate(post.date_posted),
  };
  // Drop the undefined entries so the JSON response stays small.
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== undefined),
  ) as JobDraft;
}
