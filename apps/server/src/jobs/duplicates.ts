/**
 * How two jobs are judged to be the same posting. A job is a duplicate of another when its
 * URL points at the same page (ignoring tracking parameters and the fragment, but not the
 * parameters that name the posting) or when its title and company match ignoring case and
 * surrounding whitespace.
 */

/**
 * Query parameters that identify the posting rather than track where the visitor came from.
 * Indeed (`jk`), Glassdoor (`jl`), LinkedIn search pages (`currentJobId`), embedded ATS
 * postings (`gh_jid`, `ashby_jid`) and many career sites put the job id in the query string, so
 * dropping the whole string would make every posting on those sites look the same.
 */
const ID_PARAMETERS = new Set(['jk', 'jl', 'job', 'req', 'posting', 'p']);
/** Parameters that end in "id" but track the visitor, not the posting. */
const TRACKING_PARAMETERS = new Set([
  'refid',
  'trackingid',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'clickid',
  'sessionid',
  'visitorid',
  'userid',
  'utm_id',
]);
function identifiesPosting(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMETERS.has(lower)) return false;
  return ID_PARAMETERS.has(lower) || lower.endsWith('id');
}

/**
 * The comparable form of a job URL: lower-cased origin plus path, with no trailing slash, plus
 * any query parameters that identify the posting (sorted, so order does not matter).
 */
export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/+$/, '');
    const ids = [...parsed.searchParams.entries()]
      .filter(([name, value]) => value !== '' && identifiesPosting(name))
      .map(([name, value]) => `${name.toLowerCase()}=${value}`)
      .sort();
    return `${parsed.origin.toLowerCase()}${path}${ids.length ? `?${ids.join('&')}` : ''}`;
  } catch {
    return url.trim().toLowerCase() || null;
  }
}

/** The comparable form of a title or company name. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface DuplicateCandidate {
  title: string;
  company: string;
  url?: string | null;
}

/** Whether `existing` looks like the same posting as `incoming`. */
export function isDuplicate(incoming: DuplicateCandidate, existing: DuplicateCandidate): boolean {
  const url = normalizeJobUrl(incoming.url);
  if (url && url === normalizeJobUrl(existing.url)) return true;
  const title = normalizeText(incoming.title);
  const company = normalizeText(incoming.company);
  return (
    title !== '' &&
    company !== '' &&
    title === normalizeText(existing.title) &&
    company === normalizeText(existing.company)
  );
}
