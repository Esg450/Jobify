import type { CheerioAPI } from 'cheerio';
import type { JobDraft } from '../job-draft.js';
import type { JobParser, PageContext } from '../job-parser.js';
import {
  cleanText,
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  toCalendarDate,
} from '../normalize.js';
import { spacedText } from '../page-signals.js';
import { cleanCompanyName, parseSalary, splitPageTitle } from '../text-signals.js';

/** Selectors are tried in order; the first one that finds an element wins. */
type Selectors = string[];

interface Profile {
  id: string;
  site: string;
  /** The profile applies when any of these selectors finds something. */
  detect: Selectors;
  title: Selectors;
  company?: Selectors;
  location?: Selectors;
  description: Selectors;
  employment?: Selectors;
  posted?: Selectors;
  workplace?: Selectors;
  /** Text that holds the salary, if the site shows it separately. */
  salary?: Selectors;
}

/**
 * Selectors for the pages people paste after signing in or when a site blocks the server.
 * Each profile is keyed on markup the site has kept stable for a while; when a site changes,
 * only the profile needs updating.
 */
const PROFILES: Profile[] = [
  {
    id: 'linkedin-app',
    site: 'LinkedIn',
    detect: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title'],
    title: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title'],
    company: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
    ],
    location: [
      '.job-details-jobs-unified-top-card__primary-description-container',
      '.jobs-unified-top-card__primary-description',
    ],
    description: ['#job-details', '.jobs-description__content', '.jobs-box__html-content'],
    employment: [
      '.job-details-jobs-unified-top-card__job-insight',
      '.jobs-unified-top-card__job-insight',
    ],
  },
  {
    id: 'indeed',
    site: 'Indeed',
    detect: [
      '[data-testid="viewjob-job-content"]',
      '.react-native-html-content',
      '#jobDescriptionText',
    ],
    title: [
      '[data-testid="vj-job-title"]',
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobsearch-JobInfoHeader-title',
    ],
    company: [
      '[data-testid="company-info-metadata"] a',
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name="true"]',
    ],
    location: [
      '[data-testid="job-location"]',
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="company-info-metadata"]',
    ],
    description: [
      '.react-native-html-content',
      '#react-native-html-content',
      '[data-testid="vj-job-description-heading"] + div',
      '#jobDescriptionText',
    ],
    salary: ['[data-testid="structured-job-summary"]', '#salaryInfoAndJobType'],
    employment: ['[data-testid="structured-job-summary"]', '#salaryInfoAndJobType'],
    workplace: ['[data-testid="structured-job-summary"]', '#salaryInfoAndJobType'],
  },
  {
    id: 'glassdoor',
    site: 'Glassdoor',
    detect: ['[class*="JobDetails_jobDescription"]', '[data-test="job-details-header"]'],
    title: [
      'h1[id^="jd-job-title"]',
      '[data-test="job-details-header"] h1',
      '[data-test="job-title"]',
      'h1[class*="JobDetails_jobTitle"]',
    ],
    company: ['[class*="EmployerProfile_employerNameHeading"]', '[data-test="employer-name"]'],
    location: [
      '[data-test="job-details-header"] [data-test="location"]',
      '[data-test="location"]',
      '[class*="JobDetails_location"]',
    ],
    description: [
      '[class*="JobDetails_jobDescription"]',
      '.jobDescriptionContent',
      '#JobDescriptionContainer',
    ],
    salary: [
      '[data-test="detailSalary"]',
      '[class*="JobCard_salaryEstimate"]',
      '[class*="SalaryEstimate"]',
    ],
  },
  {
    id: 'ziprecruiter',
    site: 'ZipRecruiter',
    detect: ['.job_description', '[class*="job_description"]'],
    title: ['h1.job_title', 'h1[class*="job_title"]', 'h1'],
    company: ['.hiring_company_text', '[class*="hiring_company"]', '[class*="company_name"]'],
    location: ['.job_location', '[class*="job_location"]', '[class*="location"]'],
    description: ['.job_description', '[class*="job_description"]'],
    salary: ['[class*="salary"]', '[class*="compensation"]'],
  },
  {
    id: 'workday-page',
    site: 'Workday',
    detect: ['[data-automation-id="jobPostingHeader"]'],
    title: ['[data-automation-id="jobPostingHeader"]'],
    location: ['[data-automation-id="locations"] dd', '[data-automation-id="locations"]'],
    description: ['[data-automation-id="jobPostingDescription"]'],
    employment: ['[data-automation-id="time"] dd', '[data-automation-id="time"]'],
    posted: ['[data-automation-id="postedOn"] dd', '[data-automation-id="postedOn"]'],
    workplace: ['[data-automation-id="remoteType"] dd', '[data-automation-id="remoteType"]'],
  },
  {
    id: 'oracle-page',
    site: 'Oracle',
    detect: ['.job-details__title'],
    title: ['.job-details__title'],
    location: [
      '.job-meta__pin-item',
      '.job-details__location',
      '[class*="job-meta"] [class*="location"]',
    ],
    description: ['.job-details__description-content', '.job-details__description'],
    posted: ['.job-meta__posting-date', '[class*="posting-date"]'],
  },
  {
    id: 'eightfold-page',
    site: 'Eightfold',
    detect: ['.position-job-description', '.position-title'],
    title: ['.position-title', 'h1.position-title'],
    location: ['.position-location'],
    description: ['.position-job-description'],
  },
  {
    id: 'icims-page',
    site: 'iCIMS',
    detect: ['.iCIMS_JobContent', '.iCIMS_Header'],
    title: ['.iCIMS_Header h1', 'h1.iCIMS_Header_JobTitle', '.iCIMS_JobHeader h1', 'h1'],
    location: [
      '.iCIMS_JobHeaderField:has(.iCIMS_JobHeaderTag:contains("Location")) .iCIMS_JobHeaderData',
      '.iCIMS_JobHeaderField:contains("Location")',
    ],
    description: ['.iCIMS_JobContent', '.iCIMS_InfoMsg_Job', '.iCIMS_Expandable_Container'],
    employment: [
      '.iCIMS_JobHeaderField:contains("Type")',
      '.iCIMS_JobHeaderField:contains("Employment")',
    ],
    posted: ['.iCIMS_JobHeaderField:contains("Posted")'],
  },
  {
    id: 'successfactors-page',
    site: 'SuccessFactors',
    detect: ['.jobDisplay', 'span.jobdescription', '#job-title', '.jobdescription'],
    title: ['#job-title', 'h1.jobTitle', '.jobTitle', 'h1'],
    location: [
      '[data-careersite-propertyid="location"]',
      '.jobGeoLocation',
      '.joblocation',
      '[itemprop="jobLocation"]',
    ],
    description: ['.jobDisplayShell', 'span.jobdescription', '.jobdescription', '.jobDisplay'],
    posted: ['[data-careersite-propertyid="date"]', '.jobDate'],
  },
  {
    id: 'greenhouse-page',
    site: 'Greenhouse',
    detect: ['.job__description', '#content .opening', '.app-title'],
    title: ['.job__title h1', 'h1.app-title', '.job__title'],
    location: ['.job__location', '.location'],
    description: ['.job__description', '#content .body', '#content'],
  },
  {
    id: 'lever-page',
    site: 'Lever',
    detect: ['.posting-headline', '.posting-page'],
    title: ['.posting-headline h2', '.posting-headline'],
    location: ['.posting-categories .location', '.posting-category.location'],
    description: ['.section-wrapper.page-full-width', '.posting-page .content'],
    employment: ['.posting-categories .commitment', '.posting-category.commitment'],
    workplace: ['.posting-categories .workplaceTypes', '.posting-category.workplaceTypes'],
  },
];

/**
 * Reads postings from the rendered markup of well-known sites, for pages users paste from
 * their browser (signed-in LinkedIn, Indeed, Glassdoor, Workday, ...). Unlike the API-based
 * parsers, this needs no network access and does not care about the URL.
 */
export class RenderedPageParser implements JobParser {
  readonly id = 'rendered-page';

  matches(): boolean {
    return true;
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const $ = await page.document();
    for (const profile of PROFILES) {
      if (!profile.detect.some((selector) => $(selector).length > 0)) continue;
      const draft = RenderedPageParser.extract($, profile);
      if (draft) return draft;
    }
    return null;
  }

  static extract($: CheerioAPI, profile: Profile): JobDraft | null {
    const element = (selectors: Selectors | undefined) =>
      selectors?.map((selector) => $(selector).get(0)).find(Boolean);
    const text = (selectors: Selectors | undefined) => {
      const found = element(selectors);
      return found ? cleanText(spacedText(found)) : undefined;
    };

    const rawTitle = text(profile.title);
    const title = rawTitle && (splitPageTitle(rawTitle)?.title ?? rawTitle);
    if (!title) return null;

    const body = element(profile.description);
    const description = htmlToMarkdown(body ? $.html(body) : undefined);
    if (!description || description.length < 100) return null;

    const company = cleanCompanyName(text(profile.company));
    const location = RenderedPageParser.locationText(text(profile.location), company);
    const extras = [profile.employment, profile.workplace, profile.salary]
      .map(text)
      .filter(Boolean)
      .join(' ');
    const salary = parseSalary(text(profile.salary));

    return {
      source: profile.site,
      title,
      company: company ?? cleanCompanyName($('meta[property="og:site_name"]').attr('content')),
      location: cleanText(location),
      workplaceType: inferWorkplaceType(text(profile.workplace), location, extras),
      employmentType: normalizeEmploymentType(text(profile.employment) ?? extras),
      description,
      postedOn: toCalendarDate(text(profile.posted)?.replace(/^posted(?:\s+on)?:?\s*/i, '')),
      ...(salary ?? {}),
    };
  }

  /**
   * Location labels often share an element with the company and a rating
   * ("Acme · 4.0 · Remote"), and some sites render the same text twice.
   */
  private static locationText(
    raw: string | undefined,
    company: string | undefined,
  ): string | undefined {
    if (!raw) return undefined;
    let text = raw;
    if (company && text.startsWith(company)) text = text.slice(company.length);
    text = text
      .replace(/(?:^|\s)[·•|]\s*\d(?:\.\d)?(?:\s*out of 5(?: stars)?)?/g, ' ')
      .replace(/\s+[·•|]\s+.*$/, '')
      .replace(/^[\s·•|]+/, '')
      .replace(/^locations?:?\s+/i, '')
      .trim();
    const half = text.slice(0, Math.floor(text.length / 2)).trim();
    if (half && text === `${half} ${half}`) text = half;
    return cleanText(text);
  }
}
