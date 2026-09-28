/**
 * Heuristics that pull job details out of free text. They are deliberately conservative:
 * a wrong value is worse than an empty one, since the user reviews the draft either way.
 */
import type { EmploymentType, SalaryPeriod, WorkplaceType } from '../jobs/job.constants.js';
import { cleanText, normalizeEmploymentType } from './normalize.js';

const CURRENCY_CODES: Record<string, string> = {
  $: 'USD',
  us$: 'USD',
  usd: 'USD',
  '£': 'GBP',
  gbp: 'GBP',
  '€': 'EUR',
  eur: 'EUR',
  c$: 'CAD',
  ca$: 'CAD',
  cad: 'CAD',
  a$: 'AUD',
  au$: 'AUD',
  aud: 'AUD',
  nz$: 'NZD',
  nzd: 'NZD',
  chf: 'CHF',
  sek: 'SEK',
  nok: 'NOK',
  dkk: 'DKK',
  pln: 'PLN',
  inr: 'INR',
  '₹': 'INR',
  sgd: 'SGD',
  s$: 'SGD',
  '¥': 'JPY',
  jpy: 'JPY',
  brl: 'BRL',
  r$: 'BRL',
  mxn: 'MXN',
  zar: 'ZAR',
};

const CURRENCY =
  '(?:us\\$|ca\\$|c\\$|a\\$|au\\$|nz\\$|s\\$|r\\$|[$£€₹¥]|usd|gbp|eur|cad|aud|nzd|chf|sek|nok|dkk|pln|inr|sgd|jpy|brl|mxn|zar)';
const AMOUNT = '\\d{1,3}(?:[,.]\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
const K = '\\s?k(?![a-z])';
const RANGE = '\\s*(?:-|–|—|to|and)\\s*';
const PERIOD =
  '(?:\\s*(?:/|per|a|an|each)\\s*(?:year|yr|annum|month|mo|week|wk|day|hour|hr|h)\\b|\\s*(?:annually|yearly|monthly|weekly|daily|hourly)\\b)?';

const SALARY_PATTERNS = [
  // $120,000 - $150,000 per year, £50k–£60k, USD 120,000 to 150,000
  new RegExp(
    `(${CURRENCY})\\s?(${AMOUNT})(${K})?${RANGE}(?:${CURRENCY}\\s?)?(${AMOUNT})(${K})?${PERIOD}`,
    'i',
  ),
  // 120,000 - 150,000 USD
  new RegExp(`(${AMOUNT})(${K})?${RANGE}(${AMOUNT})(${K})?\\s?(${CURRENCY})${PERIOD}`, 'i'),
  // $85 per hour, £45,000 per annum (single amount, needs a period to be trusted)
  new RegExp(`(${CURRENCY})\\s?(${AMOUNT})(${K})?(${PERIOD.slice(0, -1)})`, 'i'),
];

export interface SalaryDetails {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
}

function amount(text: string, thousands: string | undefined): number {
  // "120.000" (European thousands) vs "12.5" (decimal): three digits after a dot means thousands.
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(text)
    ? text.replace(/\./g, '')
    : text.replace(/,/g, '');
  return Math.round(Number(normalized) * (thousands ? 1000 : 1));
}

function periodFrom(text: string, min: number): SalaryPeriod {
  const lower = text.toLowerCase();
  if (/hour|hr\b|\bh\b|hourly/.test(lower)) return 'hour';
  if (/day|daily/.test(lower)) return 'day';
  if (/week|wk|weekly/.test(lower)) return 'week';
  if (/month|\bmo\b|monthly/.test(lower)) return 'month';
  if (/year|yr|annum|annual/.test(lower)) return 'year';
  // No period stated: small numbers are almost always hourly rates.
  return min < 400 ? 'hour' : 'year';
}

/** Finds the first salary or salary range in a piece of text. */
export function parseSalary(text: string | undefined | null): SalaryDetails | undefined {
  if (!text) return undefined;

  for (const [index, pattern] of SALARY_PATTERNS.entries()) {
    const match = pattern.exec(text);
    if (!match) continue;

    let currency: string;
    let min: number;
    let max: number | undefined;
    if (index === 1) {
      currency = match[5];
      min = amount(match[1], match[2]);
      max = amount(match[3], match[4]);
    } else {
      currency = match[1];
      min = amount(match[2], match[3]);
      max = index === 0 ? amount(match[4], match[5]) : undefined;
    }

    const period = periodFrom(match[0], min);
    const plausible = period === 'hour' ? min >= 5 && min < 2000 : min >= 500 && min < 5_000_000;
    if (!plausible || (max !== undefined && max < min)) continue;

    return {
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: CURRENCY_CODES[currency.toLowerCase()] ?? currency.toUpperCase(),
      salaryPeriod: period,
    };
  }
  return undefined;
}

/** Words that mean a page or title is about a company's job listings rather than one job. */
const CAREERS_WORDS =
  /^(?:careers?|jobs?|job (?:details?|openings?|opportunities|search|board)|open (?:positions?|roles?)|current openings|vacancies|join (?:us|our team|the team)|work (?:with|for|at) us|we'?re hiring|hiring|employment|apply(?: now)?|home)$/i;

const JOB_SITE_WORDS =
  /^(?:linkedin|indeed|glassdoor|ziprecruiter|monster|dice|wellfound|angellist|welcome to the jungle|otta|builtin(?: [a-z]+)?|greenhouse|lever|workday|ashby|smartrecruiters|workable|jobvite|icims|myworkdayjobs)$/i;

const TITLE_SEPARATORS = /\s+(?:[-–—|·•:]|::|>>)\s+/;

/** Strips "Careers", "Jobs" and similar from a company name taken from a page. */
export function cleanCompanyName(name: string | undefined | null): string | undefined {
  let text = cleanText(name);
  if (!text) return undefined;
  text = text
    .replace(/\.jobs$/i, '')
    .replace(/^(?:careers?|jobs?|work|working)\s+(?:at|with|for)\s+/i, '')
    .replace(/^(?:join|welcome to)\s+/i, '')
    .replace(
      /\s*[-–—|:]\s*(?:careers?|jobs?|job board|hiring|talent|recruiting|job opportunities).*$/i,
      '',
    )
    .replace(
      /\s+(?:careers?|jobs?|job board|hiring|talent|recruiting|job portal|career site)$/i,
      '',
    )
    .replace(/\s*\((?:careers?|jobs?)\)$/i, '')
    .trim();
  if (!text || CAREERS_WORDS.test(text) || JOB_SITE_WORDS.test(text)) return undefined;
  return text;
}

const JOB_TITLE_WORDS =
  /\b(?:engineer|developer|manager|director|analyst|designer|architect|scientist|specialist|associate|assistant|coordinator|consultant|lead|head|chief|officer|vp|vice president|president|intern|internship|technician|nurse|therapist|teacher|accountant|administrator|representative|recruiter|marketer|writer|editor|researcher|strategist|partner|advisor|counsel|attorney|paralegal|clerk|operator|driver|mechanic|electrician|sales|account executive|product|program|project|principal|senior|junior|staff|sr\.?|jr\.?)\b/i;

/** Does this read like the title of a job rather than a page or a slogan? */
export function looksLikeJobTitle(text: string | undefined | null): boolean {
  return !!text && JOB_TITLE_WORDS.test(text) && !isListingTitle(text);
}

export interface TitleParts {
  title: string;
  company?: string;
}

/**
 * Page titles usually pad the job title with the company and site name, e.g.
 * "Senior Engineer - Acme Careers" or "Data Analyst at Globex | LinkedIn". Returns the job
 * title on its own and, when one of the parts looks like a company, the company.
 */
/** Short tokens that look like a company in "Title - X" but are really a region or a mode. */
const NOT_A_COMPANY = [
  /^[A-Z]{2,4}$/,
  /^(?:us|usa|uk|eu|emea|apac|latam|nyc|remote|hybrid|on-?site|global|worldwide|new|senior|junior|staff|lead)$/i,
];

export function splitPageTitle(
  pageTitle: string | undefined | null,
  knownCompany?: string,
  options: { dashes?: boolean } = {},
): TitleParts | undefined {
  const text = cleanText(pageTitle);
  if (!text) return undefined;
  const separators = options.dashes === false ? /\s+[|·•]\s+/ : TITLE_SEPARATORS;

  const parts = text
    .split(separators)
    .map((part) =>
      part.replace(/^(?:job(?: id)?:?\s*\d+|req(?:uisition)?\s*(?:id)?:?\s*[\w-]+)$/i, '').trim(),
    )
    .filter((part) => part && !CAREERS_WORDS.test(part) && !JOB_SITE_WORDS.test(part))
    .filter(
      (part) => !/^(?:job id|req(?:uisition)? id|ref(?:erence)?)\s*[:#]?\s*[\w-]+$/i.test(part),
    );
  if (parts.length === 0) return undefined;

  const company = knownCompany?.toLowerCase();
  const withoutCompany = company ? parts.filter((part) => !isSameCompany(part, company)) : parts;
  const candidates = withoutCompany.length ? withoutCompany : parts;

  // "Senior Engineer at Acme" is the most common single-part form.
  const at = /^(.{3,120}?)\s+(?:at|@)\s+([^()]{2,60})$/i.exec(candidates[0]);
  if (candidates.length === 1 && at && !JOB_TITLE_WORDS.test(at[2])) {
    return { title: at[1].trim(), company: cleanCompanyName(at[2]) };
  }
  if (candidates.length === 1) return { title: candidates[0] };

  const titleIndex = candidates.findIndex((part) => JOB_TITLE_WORDS.test(part));
  const title = candidates[titleIndex === -1 ? 0 : titleIndex];
  // Page titles put the company last ("Senior Engineer - Acme"), so search from the end.
  const companyPart = candidates
    .filter((part) => part !== title)
    .reverse()
    .find(
      (part) =>
        part.length >= 3 &&
        part.length <= 50 &&
        !JOB_TITLE_WORDS.test(part) &&
        !NOT_A_COMPANY.some((pattern) => pattern.test(part)),
    );
  return { title, company: cleanCompanyName(companyPart) };
}

function isSameCompany(part: string, company: string): boolean {
  const normalized = part.toLowerCase();
  return (
    normalized === company ||
    cleanCompanyName(part)?.toLowerCase() === company ||
    (normalized.includes(company) && normalized.length < company.length + 12)
  );
}

/** The company in a careers page title such as "Careers | Acme" or "Zafran Careers". */
export function companyFromListingTitle(pageTitle: string | undefined | null): string | undefined {
  const parts = cleanText(pageTitle)?.split(TITLE_SEPARATORS) ?? [];
  return parts.map(cleanCompanyName).find(Boolean);
}

/** Is this page title for a listing of many jobs rather than a single posting? */
export function isListingTitle(pageTitle: string | undefined | null): boolean {
  const raw = cleanText(pageTitle)?.split(TITLE_SEPARATORS) ?? [];
  if (
    raw.some((part) => CAREERS_WORDS.test(part)) &&
    !raw.some((part) => JOB_TITLE_WORDS.test(part))
  ) {
    return true;
  }
  const parts = splitPageTitle(pageTitle);
  if (!parts) return false;
  return (
    CAREERS_WORDS.test(parts.title) ||
    /^(?:careers?|jobs?|open positions?|openings?)\s+(?:at|with|-)\s+/i.test(parts.title) ||
    /\b(?:all|open|current)\s+(?:jobs?|positions?|roles?|openings?)\b/i.test(parts.title) ||
    /\s(?:careers?|jobs?|openings?|vacancies)$/i.test(parts.title)
  );
}

/**
 * Workplace type from prose. Unlike `inferWorkplaceType`, which is meant for short labels,
 * this ignores incidental mentions ("collaborate with remote teams") and only reacts to
 * phrases that describe the role itself.
 */
export function workplaceTypeFromText(text: string | undefined | null): WorkplaceType | undefined {
  const lower = text?.toLowerCase();
  if (!lower) return undefined;
  if (/\bhybrid\b(?!\s+cloud)/.test(lower)) return 'hybrid';
  if (
    /\b(?:fully|100%|completely|permanently)[\s-]remote\b|\bremote[\s-](?:first|only|friendly|position|role|work|job|opportunity)\b|\bwork(?:ing)? from (?:home|anywhere)\b|\bthis (?:role|position|job) is remote\b|\bremote\s*[-–(]\s*(?:us|usa|uk|eu|canada|anywhere|worldwide|global)\b|\blocation:?\s*remote\b/.test(
      lower,
    )
  ) {
    return 'remote';
  }
  if (
    /\b(?:on[\s-]?site|in[\s-]?office|in[\s-]?person)\s+(?:role|position|only|required|work)\b|\bthis (?:role|position|job) is (?:on[\s-]?site|in[\s-]?office)\b|\blocation:?\s*on[\s-]?site\b/.test(
      lower,
    )
  ) {
    return 'onsite';
  }
  return undefined;
}

const EMPLOYMENT_LABEL =
  /(?:employment|job|position|contract|work)\s*type\s*[:\-–]\s*([^\n.;|]{3,40})/i;

/** Employment type from prose. Labels ("Employment type: Contract") beat loose mentions. */
export function employmentTypeFromText(
  text: string | undefined | null,
): EmploymentType | undefined {
  if (!text) return undefined;
  // A labelled value can be as terse as "Contract", so the loose matcher is fine there.
  const labelled = normalizeEmploymentType(EMPLOYMENT_LABEL.exec(text)?.[1]);
  if (labelled) return labelled;
  return employmentTypeFromWords(text.slice(0, 6000).toLowerCase());
}

function employmentTypeFromWords(lower: string): EmploymentType | undefined {
  const patterns: [RegExp, EmploymentType][] = [
    [/\bintern(?:ship)?\b/, 'internship'],
    [/\bpart[\s-]time\b/, 'part_time'],
    [/\bfull[\s-]time\b/, 'full_time'],
    [
      /\b(?:contractor|contract[\s-](?:to[\s-]hire|role|position|basis|opportunity|employment|work|job)|(?:on|as) a contract|fixed[\s-]term|c2c|corp[\s-]to[\s-]corp|1099|w2 contract)\b/,
      'contract',
    ],
    [/\b(?:temporary|temp(?:orary)? (?:role|position|assignment)|seasonal)\b/, 'temporary'],
    [/\bfreelanc(?:e|er|ing)\b/, 'freelance'],
    [/\bpermanent\b/, 'full_time'],
  ];
  let best: { index: number; type: EmploymentType } | undefined;
  for (const [pattern, type] of patterns) {
    const index = lower.search(pattern);
    if (index >= 0 && (!best || index < best.index)) best = { index, type };
  }
  return best?.type;
}

/** Pulls a location out of a "Location: City, ST" style label in prose. */
export function locationFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const match =
    /(?:^|\n|\*\*)\s*(?:job\s+)?location(?:\(s\))?\s*[:\-–]\s*\**\s*([^\n|]{2,80}?)\s*(?:\*\*|\||\n|$)/i.exec(
      text,
    );
  const location = cleanText(match?.[1]);
  if (!location || /^(?:remote|anywhere|various|multiple|flexible|n\/a|tbd)$/i.test(location)) {
    return location && /^remote$/i.test(location) ? 'Remote' : undefined;
  }
  return location;
}

/** "Acme" from an "About Acme" or "Why Acme?" heading in a description. */
export function companyFromAboutHeading(markdown: string | undefined | null): string | undefined {
  if (!markdown) return undefined;
  const match =
    /^#{1,6}\s*\**\s*(?:about|why(?: join| work at)?|who is|meet)\s+(?!us\b|the (?:role|team|job|position|company)\b|this\b|you\b)([A-Z][\w&.'-]*(?:\s+[A-Z&][\w&.'-]*){0,3})\??\s*\**\s*$/im.exec(
      markdown,
    );
  return cleanCompanyName(match?.[1]?.replace(/[?:]$/, ''));
}
