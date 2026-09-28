import type { CheerioAPI } from 'cheerio';
import type { JobDraft } from './job-draft.js';

/**
 * A page being imported. Content is loaded lazily so that parsers which talk to a
 * site's JSON API never download the HTML page.
 */
export interface PageContext {
  /** The posting URL, when the user supplied one. */
  readonly url?: URL;
  /** Raw HTML of the page (pasted by the user or fetched from `url`). */
  html(): Promise<string>;
  /** The page parsed with cheerio. */
  document(): Promise<CheerioAPI>;
  fetchJson<T>(url: string | URL): Promise<T>;
  fetchText(url: string | URL): Promise<string>;
}

/**
 * Extracts job details from a posting. To support a new site, implement this interface
 * and register the parser in `parsers/index.ts`.
 */
export interface JobParser {
  /** Stable identifier, e.g. "greenhouse". */
  readonly id: string;
  /**
   * Name of the site this parser is dedicated to, stored as the job's source.
   * Generic parsers leave it undefined and the page's hostname is used instead.
   */
  readonly site?: string;
  /**
   * Set for last-resort parsers whose results are guesses (such as the page title). Their
   * fields are replaced by AI extraction when the user asks for it.
   */
  readonly fallback?: boolean;
  /**
   * Whether this parser should try the page. Site-specific parsers match on the URL;
   * generic parsers work on any HTML and can simply return true.
   */
  matches(url: URL | undefined): boolean;
  /** Returns whatever fields could be extracted, or null if the page is not recognised. */
  parse(page: PageContext): Promise<JobDraft | null>;
}
