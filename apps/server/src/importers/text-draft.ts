import type { JobDraft } from './job-draft.js';
import { cleanText } from './normalize.js';
import { cleanCompanyName, splitPageTitle } from './text-signals.js';

const LABELS: Record<string, 'company' | 'title' | 'location'> = {
  company: 'company',
  employer: 'company',
  organization: 'company',
  organisation: 'company',
  'job title': 'title',
  title: 'title',
  position: 'title',
  role: 'title',
  location: 'location',
};

/**
 * Makes a draft from plain text the user pasted, e.g. a posting copied out of an email or
 * a job board. The first line is normally the title, and the next line often names the
 * company and location the way LinkedIn and Indeed format them ("Acme · New York, NY").
 */
export function draftFromText(text: string): JobDraft {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const draft: JobDraft = { description: text.trim() };

  // Explicit "Company: Acme" style labels are the most reliable signal.
  for (const line of lines.slice(0, 40)) {
    const match = /^([a-z ]{3,14})\s*[:\-–]\s*(.{2,100})$/i.exec(line);
    const field = match && LABELS[match[1].trim().toLowerCase()];
    if (field && !draft[field]) draft[field] = cleanText(match[2]);
  }

  const [first, second] = lines;
  if (
    !draft.title &&
    first &&
    first.length <= 120 &&
    !/[.:]$/.test(first) &&
    !/^https?:/.test(first)
  ) {
    const parts = splitPageTitle(first);
    draft.title = parts?.title ?? first;
    draft.company ??= parts?.company;
  }

  // "Acme · New York, NY (Remote)" or "Acme - London" under the title.
  if (second && second.length <= 120 && draft.title && (!draft.company || !draft.location)) {
    const [company, ...rest] = second.split(/\s+[·•|]\s+|\s+-\s+/);
    if (rest.length > 0) {
      draft.company ??= cleanCompanyName(company);
      draft.location ??= cleanText(rest[0]);
    } else if (!draft.company && looksLikeCompanyName(second)) {
      draft.company = cleanCompanyName(second);
    }
  }

  return draft;
}

function looksLikeCompanyName(line: string): boolean {
  const words = line.split(' ');
  return (
    words.length <= 5 &&
    line.length <= 40 &&
    /^[A-Z0-9]/.test(line) &&
    !/[.!?]$/.test(line) &&
    !/\b(?:posted|ago|applicants|apply|salary|per\b|remote|hybrid|on-?site|full-?time|part-?time)\b/i.test(
      line,
    )
  );
}
