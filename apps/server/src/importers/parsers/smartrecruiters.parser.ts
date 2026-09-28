import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  normalizeEmploymentType,
  toCalendarDate,
} from '../normalize.js';

interface SmartRecruitersSection {
  title?: string;
  text?: string;
}

interface SmartRecruitersPosting {
  name?: string;
  company?: { name?: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    hybrid?: boolean;
  };
  typeOfEmployment?: { label?: string };
  releasedDate?: string;
  postingUrl?: string;
  jobAd?: {
    sections?: Record<string, SmartRecruitersSection | undefined>;
  };
}

/**
 * SmartRecruiters job pages, via the public Posting API.
 *
 * Supported URL shape: https://jobs.smartrecruiters.com/{company}/{postingId}-{slug}
 */
export class SmartRecruitersParser implements JobParser {
  readonly id = 'smartrecruiters';
  readonly site = 'SmartRecruiters';

  matches(url: URL | undefined): boolean {
    return url?.hostname === 'jobs.smartrecruiters.com';
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const [company, postingSlug] = page.url!.pathname.split('/').filter(Boolean);
    const postingId = postingSlug?.match(/^\d+/)?.[0];
    if (!company || !postingId) return null;

    const posting = await page.fetchJson<SmartRecruitersPosting>(
      `https://api.smartrecruiters.com/v1/companies/${company}/postings/${postingId}`,
    );
    if (!posting.name) return null;

    const { location } = posting;
    const sections = [
      'companyDescription',
      'jobDescription',
      'qualifications',
      'additionalInformation',
    ]
      .map((key) => posting.jobAd?.sections?.[key])
      .filter((section) => section?.text)
      .map((section) => `<h2>${section!.title ?? ''}</h2>${section!.text}`);

    return {
      title: cleanText(posting.name),
      company: cleanText(posting.company?.name) ?? company,
      location: cleanText(
        [location?.city, location?.region, location?.country].filter(Boolean).join(', '),
      ),
      workplaceType: location?.hybrid ? 'hybrid' : location?.remote ? 'remote' : undefined,
      employmentType: normalizeEmploymentType(posting.typeOfEmployment?.label),
      description: htmlToMarkdown(sections.join('\n')),
      postedOn: toCalendarDate(posting.releasedDate),
      url: posting.postingUrl ?? page.url!.toString(),
    };
  }
}
