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

interface LeverPosting {
  text?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  workplaceType?: string;
  description?: string;
  lists?: { text?: string; content?: string }[];
  additional?: string;
  hostedUrl?: string;
  createdAt?: number;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

/**
 * Lever hosted job pages, via the public Postings API.
 *
 * The API does not include the company's display name, so it is left for the
 * structured data on the posting page to fill in.
 *
 * Supported URL shape: https://jobs.lever.co/{company}/{postingId}
 */
export class LeverParser implements JobParser {
  readonly id = 'lever';
  readonly site = 'Lever';

  matches(url: URL | undefined): boolean {
    return url?.hostname === 'jobs.lever.co' || url?.hostname === 'jobs.eu.lever.co';
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const [company, postingId] = page.url!.pathname.split('/').filter(Boolean);
    if (!company || !postingId) return null;

    const apiHost = page.url!.hostname === 'jobs.eu.lever.co' ? 'api.eu.lever.co' : 'api.lever.co';
    const posting = await page.fetchJson<LeverPosting>(
      `https://${apiHost}/v0/postings/${company}/${postingId}`,
    );
    if (!posting.text) return null;

    // Lever splits the posting into an intro, titled lists and a closing section.
    const sections = [
      posting.description,
      ...(posting.lists ?? []).map(
        (list) => `<h3>${list.text ?? ''}</h3><ul>${list.content ?? ''}</ul>`,
      ),
      posting.additional,
    ];
    const location = cleanText(posting.categories?.location);

    return {
      title: cleanText(posting.text),
      location,
      workplaceType: inferWorkplaceType(posting.workplaceType, location),
      employmentType: normalizeEmploymentType(posting.categories?.commitment),
      description: htmlToMarkdown(sections.filter(Boolean).join('\n')),
      postedOn: toCalendarDate(posting.createdAt),
      salaryMin: posting.salaryRange?.min,
      salaryMax: posting.salaryRange?.max,
      salaryCurrency: posting.salaryRange?.currency,
      salaryPeriod: normalizeSalaryPeriod(posting.salaryRange?.interval),
      url: posting.hostedUrl ?? page.url!.toString(),
    };
  }
}
