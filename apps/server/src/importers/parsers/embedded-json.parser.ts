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
import { isListingTitle, parseSalary } from '../text-signals.js';

type Json = Record<string, unknown>;

const TITLE_KEYS = [
  'title',
  'jobTitle',
  'job_title',
  'positionTitle',
  'position_title',
  'postingTitle',
  'posting_name',
  'jobName',
  'name',
];
const DESCRIPTION_KEYS = [
  'description',
  'jobDescription',
  'job_description',
  'descriptionHtml',
  'description_html',
  'jobDescriptionHtml',
  'descriptionText',
  'fullDescription',
  'postingDescription',
  'content',
  'body',
  'details',
];
/** Sites that split the posting into fields, in the order they read best. */
const SECTION_KEYS: [string, string | undefined][] = [
  ['jobSummary', undefined],
  ['summary', undefined],
  ['description', undefined],
  ['jobDescription', undefined],
  ['job_description', undefined],
  ['descriptionHtml', undefined],
  ['responsibilities', 'Responsibilities'],
  ['keyQualifications', 'Key qualifications'],
  ['minimumQualifications', 'Minimum qualifications'],
  ['requirements', 'Requirements'],
  ['qualifications', 'Qualifications'],
  ['preferredQualifications', 'Preferred qualifications'],
  ['additionalRequirements', 'Additional requirements'],
  ['educationAndExperience', 'Education and experience'],
  ['benefits', 'Benefits'],
];

const COMPANY_KEYS = [
  'company',
  'companyName',
  'company_name',
  'employer',
  'employerName',
  'employer_name',
  'hiringOrganization',
  'organization',
  'organizationName',
  'brand',
  'brandName',
];
const LOCATION_KEYS = [
  'workLocations',
  'work_locations',
  'location',
  'locationName',
  'location_name',
  'jobLocation',
  'job_location',
  'formattedLocation',
  'primaryLocation',
  'primary_location',
  'locations',
  'officeLocation',
  'office',
  'city',
];
const EMPLOYMENT_KEYS = [
  'employmentType',
  'employment_type',
  'jobType',
  'job_type',
  'schedule',
  'timeType',
  'time_type',
  'commitment',
  'contractType',
  'contract_type',
  'type',
];
const WORKPLACE_KEYS = [
  'workplaceType',
  'workplace_type',
  'workplace',
  'locationType',
  'location_type',
  'remoteType',
  'remote_type',
  'workArrangement',
  'workModel',
  'work_model',
  'remote',
  'isRemote',
  'is_remote',
];
const POSTED_KEYS = [
  'createdOn',
  'datePosted',
  'postedDate',
  'posted_date',
  'postedAt',
  'posted_at',
  'publishedAt',
  'published_at',
  'published',
  'publishDate',
  'publicationDate',
  'datePublished',
  'postingDate',
  'posting_date',
  'openDate',
  'createdAt',
  'created_at',
];
const DEADLINE_KEYS = [
  'validThrough',
  'closingDate',
  'closing_date',
  'deadline',
  'applicationDeadline',
  'expiresAt',
  'expires_at',
  'closeDate',
];
const URL_KEYS = [
  'absolute_url',
  'absoluteUrl',
  'jobUrl',
  'job_url',
  'hostedUrl',
  'canonicalUrl',
  'applyUrl',
  'apply_url',
  'url',
];
const SALARY_MIN_KEYS = [
  'salaryMin',
  'salary_min',
  'minSalary',
  'min_salary',
  'salaryFrom',
  'salary_from',
  'minValue',
  'min',
  'from',
  'low',
];
const SALARY_MAX_KEYS = [
  'salaryMax',
  'salary_max',
  'maxSalary',
  'max_salary',
  'salaryTo',
  'salary_to',
  'maxValue',
  'max',
  'to',
  'high',
];
const SALARY_OBJECT_KEYS = [
  'salary',
  'salaryRange',
  'salary_range',
  'compensation',
  'baseSalary',
  'pay',
  'payRange',
  'pay_range',
];
const CURRENCY_KEYS = [
  'salaryCurrency',
  'salary_currency',
  'salary_currency_iso_code',
  'currency',
  'currencyCode',
  'currency_code',
];
const PERIOD_KEYS = [
  'salaryPeriod',
  'salary_period',
  'salary_frequency',
  'payPeriod',
  'pay_period',
  'interval',
  'unitText',
  'frequency',
];

const MAX_NODES = 60_000;
const MAX_DEPTH = 14;

/**
 * Many career sites render on the client and ship the posting as JSON inside a script tag
 * (Next.js `__NEXT_DATA__`, hydration data, `window.__INITIAL_STATE__`, ...). This parser
 * digs through that JSON for the object that looks most like a job.
 */
export class EmbeddedJsonParser implements JobParser {
  readonly id = 'embedded-json';

  matches(): boolean {
    return true;
  }

  async parse(page: PageContext): Promise<JobDraft | null> {
    const $ = await page.document();
    let best: { job: Json; score: number } | undefined;

    for (const script of $('script').toArray()) {
      const type = $(script).attr('type') ?? '';
      if (type.includes('ld+json')) continue;
      const text = $(script).text();
      if (text.length < 100 || text.length > 4_000_000) continue;

      const blobs = /json/i.test(type) ? [parseJson(text)] : extractJsonFromScript(text);
      for (const blob of blobs) {
        const found = findJob(blob);
        if (found && (!best || found.score > best.score)) best = found;
      }
    }

    return best ? EmbeddedJsonParser.toDraft(best.job) : null;
  }

  static toDraft(job: Json): JobDraft {
    const location = locationValue(pick(job, LOCATION_KEYS));
    const workplace = pick(job, WORKPLACE_KEYS);

    return {
      title: cleanText(stringValue(pick(job, TITLE_KEYS))),
      company: cleanText(stringValue(pick(job, COMPANY_KEYS))),
      location,
      workplaceType:
        workplace === true
          ? 'remote'
          : inferWorkplaceType(typeof workplace === 'string' ? workplace : undefined, location),
      employmentType: normalizeEmploymentType(stringValue(pick(job, EMPLOYMENT_KEYS))),
      description: combineSections(job),
      postedOn: toCalendarDate(dateValue(pick(job, POSTED_KEYS))),
      deadlineOn: toCalendarDate(dateValue(pick(job, DEADLINE_KEYS))),
      url: urlValue(pick(job, URL_KEYS)),
      ...salaryValue(job),
    };
  }
}

/** The description, or the posting's separate sections joined under headings. */
function combineSections(job: Json): string | undefined {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [key, heading] of SECTION_KEYS) {
    const value = stringValue(job[key]);
    if (!value || value.trim().length < 20 || seen.has(value)) continue;
    seen.add(value);
    const text = toMarkdown(value);
    if (text) parts.push(heading ? `## ${heading}\n\n${text}` : text);
  }
  if (parts.length === 0) {
    return toMarkdown(stringValue(pick(job, DESCRIPTION_KEYS)));
  }
  return parts.join('\n\n');
}

function toMarkdown(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.includes('&lt;') ? decodeEntities(value) : value;
  return /<[a-z][^>]*>/i.test(text)
    ? htmlToMarkdown(text)
    : text.replace(/\r\n?/g, '\n').trim() || undefined;
}

/** Pulls JSON out of inline scripts: `JSON.parse("...")` literals and `window.__X__ = {...}`. */
export function extractJsonFromScript(text: string): unknown[] {
  const blobs: unknown[] = [];

  for (const match of text.matchAll(
    /JSON\.parse\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g,
  )) {
    const literal = match[1];
    try {
      const string: unknown = literal.startsWith('"')
        ? JSON.parse(literal)
        : JSON.parse(`"${literal.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`);
      if (typeof string === 'string') blobs.push(JSON.parse(string));
    } catch {
      // Not valid JSON; move on.
    }
    if (blobs.length >= 5) break;
  }

  const assignments = text.matchAll(
    /(?:window|self|globalThis)?\.?\b(?:__[A-Za-z_]+__|initialState|preloadedState|pageData|jobData|jobPosting|job|posting|data)\s*=\s*(?=[[{])/g,
  );
  let count = 0;
  for (const match of assignments) {
    const json = balancedJson(text, match.index + match[0].length);
    if (json) {
      const parsed = parseJson(json);
      if (parsed !== undefined) blobs.push(parsed);
    }
    if (++count >= 8) break;
  }

  return blobs;
}

/** Returns the JSON value starting at `start`, or undefined if brackets never balance. */
function balancedJson(text: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length && index - start < 2_000_000; index++) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Depth-first search for the object that most resembles a job posting. */
function findJob(root: unknown): { job: Json; score: number } | undefined {
  let best: { job: Json; score: number } | undefined;
  let visited = 0;

  const visit = (node: unknown, depth: number) => {
    if (visited++ > MAX_NODES || depth > MAX_DEPTH || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const object = node as Json;
    const score = jobScore(object);
    if (score > 0 && (!best || score > best.score)) best = { job: object, score };
    for (const value of Object.values(object)) visit(value, depth + 1);
  };

  visit(root, 0);
  return best;
}

function jobScore(object: Json): number {
  const titleKey = TITLE_KEYS.find((key) => typeof object[key] === 'string');
  const title = titleKey && (object[titleKey] as string).trim();
  const description = stringValue(pick(object, DESCRIPTION_KEYS));
  if (!title || title.length < 3 || title.length > 200 || isListingTitle(title)) return 0;
  if (!description || description.length < 200) return 0;
  // UI translations ("{{companyName}} uses AI...") also come as title + description pairs.
  if (/\{\{|%\(|\$\{/.test(title) || /\{\{/.test(description)) return 0;

  let score = titleKey === 'name' ? 2 : 4;
  score += Math.min(description.length / 1000, 5);
  for (const keys of [
    COMPANY_KEYS,
    LOCATION_KEYS,
    EMPLOYMENT_KEYS,
    WORKPLACE_KEYS,
    POSTED_KEYS,
    URL_KEYS,
  ]) {
    if (pick(object, keys) !== undefined) score += 2;
  }
  if (
    SALARY_OBJECT_KEYS.some((key) => key in object) ||
    SALARY_MIN_KEYS.some((key) => key in object)
  )
    score += 2;
  return score;
}

function pick(object: Json, keys: string[]): unknown {
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(stringValue).filter(Boolean);
    return parts.length ? parts.slice(0, 3).join('; ') : undefined;
  }
  if (value && typeof value === 'object') {
    const object = value as Json;
    const named = stringValue(
      pick(object, [
        'html',
        'text',
        'name',
        'label',
        'displayName',
        'display_name',
        'value',
        'title',
        'content',
      ]),
    );
    if (named) return named;
    // Descriptions split into sections ({ company: "<p>…", role: "<p>…" }).
    const sections = Object.values(object).filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 10,
    );
    return sections.length ? sections.join('\n') : undefined;
  }
  return undefined;
}

function locationValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.map(locationValue).filter(Boolean);
    return parts.length ? cleanText([...new Set(parts)].slice(0, 3).join('; ')) : undefined;
  }
  if (value && typeof value === 'object') {
    const object = value as Json;
    const named = stringValue(
      pick(object, [
        'name',
        'displayName',
        'display_name',
        'formatted',
        'formattedAddress',
        'label',
        'text',
        'value',
      ]),
    );
    if (named) return cleanText(named);
    const parts = [
      pick(object, ['city', 'locality', 'addressLocality']),
      pick(object, ['state', 'region', 'province', 'addressRegion', 'stateCode', 'state_code']),
      pick(object, ['country', 'countryName', 'addressCountry', 'countryCode', 'country_code']),
    ].map(stringValue);
    return cleanText(parts.filter(Boolean).join(', '));
  }
  return cleanText(stringValue(value));
}

function dateValue(value: unknown): string | number | undefined {
  if (typeof value === 'number') return value < 1e11 ? value * 1000 : value;
  return typeof value === 'string' ? value : undefined;
}

function urlValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text && /^https?:\/\//.test(text) ? text : undefined;
}

function salaryValue(job: Json): Partial<JobDraft> {
  const nested = pick(job, SALARY_OBJECT_KEYS);
  const source =
    nested && typeof nested === 'object' && !Array.isArray(nested) ? (nested as Json) : job;
  const min = toWholeNumber(pick(source, SALARY_MIN_KEYS));
  const max = toWholeNumber(pick(source, SALARY_MAX_KEYS));
  if (min || max) {
    return {
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: stringValue(pick(source, CURRENCY_KEYS) ?? pick(job, CURRENCY_KEYS))
        ?.toUpperCase()
        .slice(0, 3),
      salaryPeriod: normalizeSalaryPeriod(
        stringValue(pick(source, PERIOD_KEYS) ?? pick(job, PERIOD_KEYS)),
      ),
    };
  }
  return typeof nested === 'string' ? (parseSalary(nested) ?? {}) : {};
}
