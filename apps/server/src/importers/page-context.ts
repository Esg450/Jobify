import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { PageContext } from './job-parser.js';

export interface Fetcher {
  text(url: string | URL): Promise<string>;
  json<T>(url: string | URL): Promise<T>;
}

/** PageContext that fetches the page at most once, and only when a parser asks for it. */
export class LazyPageContext implements PageContext {
  private htmlPromise?: Promise<string>;
  private documentPromise?: Promise<CheerioAPI>;

  constructor(
    private readonly fetcher: Fetcher,
    readonly url?: URL,
    html?: string,
  ) {
    if (html !== undefined) this.htmlPromise = Promise.resolve(html);
  }

  html(): Promise<string> {
    if (!this.htmlPromise) {
      if (!this.url) return Promise.reject(new Error('No URL or HTML to parse'));
      this.htmlPromise = this.fetcher.text(this.url);
    }
    return this.htmlPromise;
  }

  document(): Promise<CheerioAPI> {
    this.documentPromise ??= this.html().then((html) => cheerio.load(html));
    return this.documentPromise;
  }

  fetchJson<T>(url: string | URL): Promise<T> {
    return this.fetcher.json<T>(url);
  }

  fetchText(url: string | URL): Promise<string> {
    return this.fetcher.text(url);
  }
}
