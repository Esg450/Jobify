/**
 * How two jobs are judged to be the same posting. A job is a duplicate of another when its
 * URL points at the same page (ignoring the query string, which usually carries tracking
 * parameters, and the fragment) or when its title and company match ignoring case and
 * surrounding whitespace.
 */

/** The comparable form of a job URL: lower-cased origin plus path, with no trailing slash. */
export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin.toLowerCase()}${path}`;
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
