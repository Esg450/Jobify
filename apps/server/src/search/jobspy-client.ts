import { describeFetchError } from '../common/errors.js';
import type { SearchJobsDto } from './search-query.dto.js';
import { DEFAULT_SEARCH_SITES } from './search.constants.js';

/**
 * One row of JobSpy's result table, as the sidecar returns it. Every column may be null:
 * boards differ in what they publish.
 */
export interface JobSpyPost {
  id: string | null;
  site: string | null;
  job_url: string | null;
  job_url_direct?: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  date_posted: string | null;
  job_type: string | null;
  is_remote: boolean | null;
  interval: string | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string | null;
  description: string | null;
  [column: string]: unknown;
}

export interface JobSpyHealth {
  status: string;
  /** The installed python-jobspy version. */
  jobspy?: string;
  sites?: string[];
}

/** A failure talking to the JobSpy service that the admin can act on. */
export class SearchProviderError extends Error {
  constructor(
    message: string,
    /** The upstream HTTP status, when there was one. */
    readonly status?: number,
  ) {
    super(message);
  }
}

const SEARCH_TIMEOUT = 3 * 60_000;

/**
 * HTTP client for the JobSpy sidecar (apps/jobspy). The paths and header also match the
 * community jobspy-api project, so either service works.
 */
export class JobSpyClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async health(): Promise<JobSpyHealth> {
    return this.get<JobSpyHealth>('/health', {}, 15_000);
  }

  async search(query: SearchJobsDto): Promise<JobSpyPost[]> {
    const params: Record<string, string> = {
      search_term: query.terms.trim(),
      site_name: (query.sites?.length ? query.sites : DEFAULT_SEARCH_SITES).join(','),
      results_wanted: String(query.limit ?? 20),
      description_format: 'markdown',
    };
    if (query.location?.trim()) params.location = query.location.trim();
    if (query.remote) params.is_remote = 'true';
    if (query.hoursOld) params.hours_old = String(query.hoursOld);
    if (query.jobType) params.job_type = query.jobType;
    if (query.country?.trim()) params.country_indeed = query.country.trim();

    const body = await this.get<{ jobs?: JobSpyPost[] }>(
      '/api/v1/search_jobs',
      params,
      SEARCH_TIMEOUT,
    );
    return Array.isArray(body.jobs) ? body.jobs : [];
  }

  private async get<T>(path: string, params: Record<string, string>, timeout: number): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), this.baseUrl.replace(/\/?$/, '/'));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: {
          Accept: 'application/json',
          ...(this.apiKey && { 'x-api-key': this.apiKey }),
        },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      throw new SearchProviderError(
        `Could not reach the JobSpy service at ${url.host}: ${describeFetchError(error)}`,
      );
    }

    if (!response.ok) {
      throw new SearchProviderError(
        await JobSpyClient.describeFailure(url.host, response),
        response.status,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new SearchProviderError(
        `The JobSpy service at ${url.host} did not return JSON. Is the URL right?`,
      );
    }
  }

  private static async describeFailure(host: string, response: Response): Promise<string> {
    if (response.status === 401 || response.status === 403) {
      return `The JobSpy service at ${host} rejected the API key`;
    }
    if (response.status === 429) {
      return `The JobSpy service at ${host} is rate limiting searches. Try again in a while.`;
    }
    let detail = '';
    try {
      const body = (await response.json()) as { detail?: unknown; message?: unknown };
      const text = body.detail ?? body.message;
      if (typeof text === 'string') detail = text;
    } catch {
      // Not JSON.
    }
    return `The JobSpy service at ${host} responded with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`;
  }
}
