import { LazyPageContext, type Fetcher } from './page-context.js';

/** Builds a PageContext backed by canned responses, keyed by URL. */
export function fakePage(options: {
  url?: string;
  html?: string;
  responses?: Record<string, unknown>;
}): LazyPageContext {
  const lookup = (url: string | URL) => {
    const key = url.toString();
    if (!options.responses || !(key in options.responses)) {
      return Promise.reject(new Error(`Unexpected request to ${key}`));
    }
    return Promise.resolve(options.responses[key]);
  };

  const fetcher: Fetcher = {
    text: (url) => lookup(url).then(String),
    json: <T>(url: string | URL) => lookup(url) as Promise<T>,
  };
  return new LazyPageContext(fetcher, options.url ? new URL(options.url) : undefined, options.html);
}
