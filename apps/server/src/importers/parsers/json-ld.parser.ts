import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  decodeEntities,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  toCalendarDate,
  toWholeNumber,
} from '../normalize.js';

type Thing = Record<string, unknown>;

interface JobPosting {
  title?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  jobLocationType?: string;
  hiringOrganization?: string | { name?: string };
  jobLocation?: Place | Place[];
  applicantLocationRequirements?: unknown;
  baseSalary?: {
    currency?: string;
    value?: { minValue?: unknown; maxValue?: unknown; value?: unknown; unitText?: string };
  };
  url?: string;
}

interface Place {
  address?:
    | string
    | {
        addressLocality?: string;
        addressRegion?: string;
        addressCountry?: string | { name?: string };
      };
}

/**
 * Reads schema.org JobPosting structured data. Most job boards and applicant tracking
 * systems embed it for Google for Jobs, so this parser covers many sites without any
 * site-specific code.
 */
export class JsonLdParser implements JobParser {
  readonly id = 'json-ld';

  matches(): boolean {
    return true;
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const $ = await page.document();
    const posting = $('script[type="application/ld+json"]')
      .toArray()
      .flatMap((script) => JsonLdParser.parseJson($(script).text()))
      .find(JsonLdParser.isJobPosting);
    return posting ? JsonLdParser.toDraft(posting) : null;
  }

  static toDraft(posting: JobPosting): JobDraft {
    const salary = posting.baseSalary?.value;
    const location = JsonLdParser.formatLocations(posting.jobLocation);
    const organization =
      typeof posting.hiringOrganization === 'string'
        ? posting.hiringOrganization
        : posting.hiringOrganization?.name;
    const employmentType = [posting.employmentType].flat()[0];
    // Descriptions are sometimes entity-escaped HTML inside the JSON.
    const description = posting.description?.includes('&lt;')
      ? decodeEntities(posting.description)
      : posting.description;

    return {
      title: cleanText(posting.title),
      company: cleanText(organization),
      location,
      workplaceType:
        posting.jobLocationType === 'TELECOMMUTE' ? 'remote' : inferWorkplaceType(location),
      employmentType: normalizeEmploymentType(employmentType),
      description: htmlToMarkdown(description),
      postedOn: toCalendarDate(posting.datePosted),
      deadlineOn: toCalendarDate(posting.validThrough),
      salaryMin: toWholeNumber(salary?.minValue ?? salary?.value),
      salaryMax: toWholeNumber(salary?.maxValue),
      salaryCurrency: posting.baseSalary?.currency,
      salaryPeriod: normalizeSalaryPeriod(salary?.unitText),
      url: posting.url,
    };
  }

  private static parseJson(text: string): Thing[] {
    try {
      const data: unknown = JSON.parse(text);
      return JsonLdParser.flatten(data);
    } catch {
      return [];
    }
  }

  /** JSON-LD can nest items in arrays and @graph containers. */
  private static flatten(data: unknown): Thing[] {
    if (Array.isArray(data)) return data.flatMap((item) => JsonLdParser.flatten(item));
    if (data && typeof data === 'object') {
      const thing = data as Thing;
      return [thing, ...JsonLdParser.flatten(thing['@graph'])];
    }
    return [];
  }

  private static isJobPosting(thing: Thing): thing is Thing & JobPosting {
    return [thing['@type']].flat().includes('JobPosting');
  }

  private static formatLocations(locations: Place | Place[] | undefined): string | undefined {
    const formatted = [locations ?? []].flat().map((place) => {
      const { address } = place;
      if (!address || typeof address === 'string') return address;
      const country =
        typeof address.addressCountry === 'string'
          ? address.addressCountry
          : address.addressCountry?.name;
      return [address.addressLocality, address.addressRegion, country].filter(Boolean).join(', ');
    });
    return cleanText([...new Set(formatted.filter(Boolean))].join('; '));
  }
}
