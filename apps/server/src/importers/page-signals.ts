import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { cleanText } from './normalize.js';

/** Headings and phrases that appear in nearly every job description. */
const DESCRIPTION_KEYWORDS = [
  /\bresponsibilit(?:y|ies)\b/,
  /\brequirements?\b/,
  /\bqualifications?\b/,
  /\bwhat you(?:'|’)?(?:ll| will) (?:do|be doing|bring|need)\b/,
  /\bwhat we(?:'|’)?re looking for\b/,
  /\babout (?:the|this) (?:role|job|position|team|opportunity)\b/,
  /\babout you\b|\bwho you are\b/,
  /\bwhat we offer\b|\bbenefits\b|\bperks\b/,
  /\bskills?\b/,
  /\bexperience\b/,
  /\bnice to have\b|\bbonus points\b|\bpreferred\b/,
  /\bcompensation\b|\bsalary\b|\bpay range\b/,
  /\bapply\b/,
  /\byou will\b|\byou(?:'|’)ll\b/,
];

const JUNK_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'form',
  'button',
  'select',
  'input',
  'nav',
  'footer',
  'aside',
  'dialog',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="dialog"]',
  '[role="search"]',
  '[aria-hidden="true"]',
  '[hidden]',
].join(', ');

const JUNK_NAME =
  /(?:^|[\s_-])(?:cookie|consent|gdpr|breadcrumbs?|share|social|sidebar|side-?bar|navbar|nav-?menu|menu|footer|banner|modal|popup|overlay|toast|related|similar|recommend(?:ed|ations?)?|more-?jobs|other-?jobs|job-?alert|alerts?|newsletter|subscribe|login|sign-?in|skip-?link|sr-only|visually-?hidden|ad-?slot|advert)(?:$|[\s_-])/i;

/**
 * The element's text with a space at every element boundary. Cheerio's `text()` runs
 * adjacent elements together ("Responsibilities<li>Ship" becomes "ResponsibilitiesShip"),
 * which breaks word matching on minified pages.
 */
export function spacedText(node: AnyNode): string {
  const parts: string[] = [];
  const walk = (current: AnyNode) => {
    if (current.type === 'text') parts.push(current.data);
    else if ('children' in current) current.children.forEach(walk);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function textLength(node: AnyNode): number {
  return spacedText(node).length;
}

function keywordCount(text: string): number {
  const lower = text.toLowerCase();
  return DESCRIPTION_KEYWORDS.filter((pattern) => pattern.test(lower)).length;
}

function linkDensity($: CheerioAPI, node: AnyNode): number {
  const total = textLength(node);
  if (total === 0) return 1;
  const linked = $(node)
    .find('a')
    .toArray()
    .reduce((sum, link) => sum + textLength(link), 0);
  return linked / total;
}

/** Removes navigation, cookie banners and other furniture from the whole document. */
export function removePageFurniture($: CheerioAPI): void {
  $(JUNK_SELECTOR).remove();
  $('[class], [id]').each((_, element) => {
    const name = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`;
    if (JUNK_NAME.test(name) && textLength(element) < 3000) $(element).remove();
  });
}

/**
 * Finds the element that holds the job description: the tightest block that contains the
 * description's tell-tale headings, ignoring page furniture and link-heavy areas.
 */
export function findDescriptionBlock($: CheerioAPI): AnyNode | undefined {
  const body = $('body').get(0) ?? $.root().get(0);
  if (!body) return undefined;

  let best: { node: AnyNode; keywords: number; length: number } | undefined;
  $('main, article, section, div, td, [role="main"]').each((_, node) => {
    const length = textLength(node);
    if (length < 300 || linkDensity($, node) > 0.5) return;
    const keywords = keywordCount(spacedText(node));
    if (keywords === 0) return;
    if (
      !best ||
      keywords > best.keywords ||
      // Same keywords in less text means a tighter block around the description.
      (keywords === best.keywords && length < best.length && length >= best.length * 0.5)
    ) {
      best = { node, keywords, length };
    }
  });

  const start = best?.node ?? $('main, [role="main"], article').get(0) ?? body;
  return tighten($, start);
}

/** Walks down through wrapper elements while a single child holds nearly all the text. */
function tighten($: CheerioAPI, node: AnyNode): AnyNode {
  let current = node;
  for (let depth = 0; depth < 15; depth++) {
    const length = textLength(current);
    const keywords = keywordCount(spacedText(current));
    const child = $(current)
      .children()
      .toArray()
      .find(
        (candidate) =>
          textLength(candidate) >= length * 0.85 &&
          keywordCount(spacedText(candidate)) === keywords,
      );
    if (!child) return current;
    current = child;
  }
  return current;
}

const LOCATION_ATTRIBUTE =
  '[class*="ocation"], [id*="ocation"], [data-automation-id*="ocation"], [data-testid*="ocation"], [data-test*="ocation"], [itemprop="jobLocation"], [itemprop="addressLocality"]';

/** Looks for a location label near the top of the page. */
export function findLocation($: CheerioAPI): string | undefined {
  const acceptable = (text: string | undefined) =>
    text &&
    text.length >= 2 &&
    text.length <= 90 &&
    !/^locations?:?$/i.test(text) &&
    !/\bsearch\b/i.test(text);

  for (const element of $(LOCATION_ATTRIBUTE).toArray()) {
    if ($(element).closest('nav, footer, header[role="banner"], form, select').length) continue;
    if ($(element).find('select, input').length) continue;
    const items = $(element)
      .find('li')
      .toArray()
      .map((item) => cleanText(spacedText(item)));
    const text = items.length
      ? [...new Set(items.filter(Boolean))].slice(0, 3).join('; ')
      : cleanText(spacedText(element))?.replace(/^locations?:?\s*/i, '');
    if (acceptable(text)) return text;
  }

  // "Location" labels in definition lists and tables.
  for (const label of $('dt, th, span, strong, b, label, p').toArray()) {
    if (!/^(?:job\s+)?locations?:?$/i.test(cleanText($(label).text()) ?? '')) continue;
    const value = $(label).next('dd, td, span, div, p').get(0);
    const text = value && cleanText(spacedText(value));
    if (acceptable(text)) return text;
  }

  return locationFromLeafElements($);
}

const US_STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
const COUNTRIES =
  'USA|US|United States|Canada|UK|United Kingdom|England|Scotland|Ireland|Germany|France|Spain|Italy|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Portugal|Czech Republic|India|Australia|New Zealand|Singapore|Japan|Israel|Brazil|Mexico|Argentina|South Africa|UAE|Philippines';
const CITY_STATE = new RegExp(
  `^(?:remote(?:\\s*[-–(]\\s*)?)?[A-Z][A-Za-z.'-]+(?:\\s[A-Z][A-Za-z.'-]+){0,2},\\s(?:(?:${US_STATES})\\b(?:,\\s(?:USA|US|United States))?|(?:${COUNTRIES})\\b)\\)?(?:\\s*[;,]\\s*.{0,40})?$`,
);

/**
 * A small element whose whole text is a place, like "Mountain View, CA" or "Berlin, Germany".
 * Pages that label nothing still tend to show the location on its own line near the title.
 */
export function locationFromLeafElements($: CheerioAPI): string | undefined {
  for (const element of $('span, div, p, li, td, dd, a, small, em, strong, h2, h3').toArray()) {
    if ($(element).children().length > 1) continue;
    const text = cleanText(spacedText(element));
    if (!text || text.length > 60 || !CITY_STATE.test(text)) continue;
    if ($(element).closest('nav, footer, form, script').length) continue;
    return text.replace(/\s+([;,])/g, '$1');
  }
  return undefined;
}

export function findPostedDate($: CheerioAPI): string | undefined {
  return (
    $(
      'meta[property="article:published_time"], meta[name="date"], meta[itemprop="datePosted"]',
    ).attr('content') ??
    $('[itemprop="datePosted"]').attr('content') ??
    $('time[datetime]').first().attr('datetime') ??
    undefined
  );
}

const JOB_LINK = [
  /\/jobs?\/[\w-]*\d{3,}/i,
  /\/careers?\/(?:jobs?\/)?[\w-]*\d{3,}/i,
  /[?&]gh_jid=\d+/,
  /[?&]ashby_jid=/,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f-]{36}/,
  /ashbyhq\.com\/[^/]+\/[0-9a-f-]{36}/,
  /\/positions?\/[\w-]+/i,
  /\/openings?\/[\w-]+/i,
  /\/vacanc(?:y|ies)\/[\w-]+/i,
  /\/job\/[\w-]+/i,
  /\/o\/[\w-]+/,
  /\/j\/[A-Z0-9]{6,}/,
];

/** Does the page link to many individual postings, i.e. is it a job list rather than a job? */
export function looksLikeJobListing($: CheerioAPI, pageUrl?: URL): boolean {
  const seen = new Set<string>();
  $('a[href]').each((_, link) => {
    const href = $(link).attr('href') ?? '';
    if (!JOB_LINK.some((pattern) => pattern.test(href))) return;
    try {
      const resolved = new URL(href, pageUrl ?? 'https://example.invalid/').toString();
      if (resolved !== pageUrl?.toString()) seen.add(resolved);
    } catch {
      // Not a URL.
    }
  });
  return seen.size >= 8;
}

/** The page's own address from its canonical link or OpenGraph tag, for pasted source. */
export function urlFromHtml(html: string, $: CheerioAPI): URL | undefined {
  const candidate =
    $('link[rel="canonical"]').attr('href') ??
    $('meta[property="og:url"]').attr('content') ??
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i.exec(html)?.[1] ??
    linkedInJobUrl(html);
  try {
    const url = candidate ? new URL(candidate) : undefined;
    return url && /^https?:$/.test(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * LinkedIn's signed-in job pages have no canonical link, but they mention their own posting
 * id far more often than the "similar jobs" they link to.
 */
function linkedInJobUrl(html: string): string | undefined {
  if (!/linkedin\.com\/jobs\/view\//.test(html)) return undefined;
  const explicit = /jobPostingId["'\\:=\s]+(\d{6,})/.exec(html)?.[1];
  if (explicit) return `https://www.linkedin.com/jobs/view/${explicit}`;

  const counts = new Map<string, number>();
  for (const match of html.matchAll(/linkedin\.com\/jobs\/view\/(\d{6,})/g)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best ? `https://www.linkedin.com/jobs/view/${best[0]}` : undefined;
}
