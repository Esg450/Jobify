import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import type { EmploymentType, SalaryPeriod, WorkplaceType } from '../jobs/job.constants.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
turndown.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button']);
// Turndown pads list markers to four characters; use the more common single space.
turndown.addRule('listItem', {
  filter: 'li',
  replacement(content, node) {
    const parent = node.parentNode as HTMLElement;
    const marker =
      parent.nodeName === 'OL'
        ? `${Number(parent.getAttribute('start') ?? 1) + Array.from(parent.children).indexOf(node as HTMLElement)}.`
        : '-';
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/g, `\n${' '.repeat(marker.length + 1)}`);
    return `${marker} ${body}${node.nextSibling && !body.endsWith('\n') ? '\n' : ''}`;
  },
});

/** Converts posting HTML into tidy Markdown. */
export function htmlToMarkdown(html: string | undefined | null): string | undefined {
  if (!html?.trim()) return undefined;
  const $ = cheerio.load(html, null, false);
  // Line breaks inside bold/italic text produce broken Markdown like "**Title\n\n**".
  $('strong, b, em, i').each((_, element) => {
    const breaks = $(element).find('br');
    if (breaks.length === 0) return;
    breaks.remove();
    $(element).after('<br><br>');
  });
  const markdown = turndown
    .turndown($.html())
    .replace(/\u00a0/g, ' ')
    // Collapse runs of hard line breaks and blank lines into a single paragraph break.
    .replace(/(?: {2}\n\s*){2,}/g, '\n\n')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return markdown || undefined;
}

/** Decodes HTML entities, e.g. for APIs that return escaped HTML. */
export function decodeEntities(text: string): string {
  return cheerio.load(`<textarea>${text}</textarea>`)('textarea').text();
}

export function cleanText(text: string | undefined | null): string | undefined {
  const cleaned = text?.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

export function inferWorkplaceType(
  ...hints: (string | undefined | null)[]
): WorkplaceType | undefined {
  const text = hints.filter(Boolean).join(' ').toLowerCase();
  if (!text) return undefined;
  if (/\bhybrid\b/.test(text)) return 'hybrid';
  if (/\b(remote|telecommute|work from home|wfh)\b/.test(text)) return 'remote';
  if (/\b(on[\s-]?site|in[\s-]?office|onsite)\b/.test(text)) return 'onsite';
  return undefined;
}

const EMPLOYMENT_PATTERNS: [RegExp, EmploymentType][] = [
  [/full[\s_-]?time|permanent|regular/, 'full_time'],
  [/part[\s_-]?time/, 'part_time'],
  [/contract|contractor/, 'contract'],
  [/intern/, 'internship'],
  [/temp/, 'temporary'],
  [/freelance/, 'freelance'],
];

export function normalizeEmploymentType(
  value: string | undefined | null,
): EmploymentType | undefined {
  const text = value?.toLowerCase();
  if (!text) return undefined;
  return EMPLOYMENT_PATTERNS.find(([pattern]) => pattern.test(text))?.[1];
}

const PERIOD_PATTERNS: [RegExp, SalaryPeriod][] = [
  [/hour/, 'hour'],
  [/day|daily/, 'day'],
  [/week/, 'week'],
  [/month/, 'month'],
  [/year|annual|annum/, 'year'],
];

export function normalizeSalaryPeriod(value: string | undefined | null): SalaryPeriod | undefined {
  const text = value?.toLowerCase();
  if (!text) return undefined;
  return PERIOD_PATTERNS.find(([pattern]) => pattern.test(text))?.[1];
}

/** Accepts ISO timestamps, dates or epoch milliseconds and returns YYYY-MM-DD. */
export function toCalendarDate(value: string | number | undefined | null): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export function toWholeNumber(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}
