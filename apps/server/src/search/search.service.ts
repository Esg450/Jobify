import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import type { JobDraft } from '../importers/job-draft.js';
import { JobsService, type DuplicateJob } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { JobSpyClient, SearchProviderError, type JobSpyHealth } from './jobspy-client.js';
import { postToDraft } from './jobspy-mapping.js';
import type { SearchCandidateDto } from './search-check.dto.js';
import type { SearchJobsDto } from './search-query.dto.js';
import { DEFAULT_SEARCH_SITES, SEARCH_SITES, type SearchSite } from './search.constants.js';
import {
  validateSearchSettings,
  type PublicSearchSettings,
  type SearchSettings,
  type UpdateSearchSettingsDto,
} from './search-settings.js';

const SETTINGS_KEY = 'search';

/** One posting found on a job board, ready to review on the Add job page. */
export interface SearchResult {
  /** JobSpy's id for the posting; unique within one search. */
  id: string;
  /** The board's id, e.g. "indeed". */
  site: string;
  draft: JobDraft;
  /** The user's existing job for this posting, if they already have it. */
  existing: DuplicateJob | null;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Boards that returned nothing, which usually means they are rate limiting the service. */
  warnings: string[];
}

export interface SearchTestResult {
  version: string | null;
  sites: string[];
}

/** Job board search through a JobSpy service (see apps/jobspy). */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
  ) {}

  /** Settings saved in the UI take precedence over environment variables. */
  async getSettings(): Promise<SearchSettings> {
    const saved = await this.settings.get<SearchSettings>(SETTINGS_KEY);
    if (saved) return saved;
    const { search } = this.config;
    return {
      enabled: Boolean(search.baseUrl),
      baseUrl: search.baseUrl ?? '',
      apiKey: search.apiKey ?? '',
    };
  }

  async getPublicSettings(): Promise<PublicSearchSettings> {
    const { apiKey, ...settings } = await this.getSettings();
    return {
      ...settings,
      hasApiKey: Boolean(apiKey),
      configured: !validateSearchSettings({ ...settings, apiKey }),
    };
  }

  async updateSettings(dto: UpdateSearchSettingsDto): Promise<PublicSearchSettings> {
    const current = await this.getSettings();
    const next: SearchSettings = {
      enabled: dto.enabled,
      baseUrl: (dto.baseUrl ?? current.baseUrl).trim().replace(/\/+$/, ''),
      apiKey: dto.apiKey?.trim() ?? current.apiKey,
    };
    const problem = next.enabled ? validateSearchSettings(next) : undefined;
    if (problem) throw new BadRequestException(problem);
    await this.settings.set<SearchSettings>(SETTINGS_KEY, next);
    return this.getPublicSettings();
  }

  async testConnection(): Promise<SearchTestResult> {
    const health = await this.call((client) => client.health());
    return SearchService.summarizeHealth(health);
  }

  private static summarizeHealth(health: JobSpyHealth): SearchTestResult {
    if (health.status !== 'ok') {
      throw new BadGatewayException(
        `The JobSpy service reported status "${health.status ?? 'unknown'}"`,
      );
    }
    return {
      version: typeof health.jobspy === 'string' ? health.jobspy : null,
      sites: Array.isArray(health.sites) ? health.sites.filter((s) => typeof s === 'string') : [],
    };
  }

  /** Searches the boards and marks the postings the user already has. */
  async search(userId: number, query: SearchJobsDto): Promise<SearchResponse> {
    const posts = await this.call((client) => client.search(query));
    this.logger.log(`Found ${posts.length} postings for "${query.terms}"`);

    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const [index, post] of posts.entries()) {
      const draft = postToDraft(post);
      if (!draft.title || !draft.company) continue;
      const id = post.id || `${post.site ?? 'job'}-${index}`;
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({ id, site: post.site ?? 'unknown', draft, existing: null });
    }
    await this.attachExisting(userId, results);

    const requested = query.sites?.length ? query.sites : DEFAULT_SEARCH_SITES;
    const answered = new Set(results.map((result) => result.site));
    const warnings = requested
      .filter((site) => !answered.has(site))
      .map(
        (site) =>
          `${SEARCH_SITES[site as SearchSite] ?? site} returned no results. It may be rate limiting searches; try again in a few minutes.`,
      );
    return { results, warnings };
  }

  /**
   * Which of some earlier results the user has saved since, keyed by result id. The Find jobs
   * page uses it to refresh the "already in your jobs" markers when the user comes back.
   */
  async check(
    userId: number,
    candidates: SearchCandidateDto[],
  ): Promise<Record<string, DuplicateJob | null>> {
    const results = candidates.map(({ id, ...draft }) => ({ id, draft, existing: null }));
    await this.attachExisting(userId, results);
    return Object.fromEntries(results.map(({ id, existing }) => [id, existing]));
  }

  private async attachExisting(
    userId: number,
    results: {
      draft: Pick<JobDraft, 'title' | 'company' | 'url'>;
      existing: DuplicateJob | null;
    }[],
  ): Promise<void> {
    for (const result of results) {
      const { title, company, url } = result.draft;
      if (!title || !company) continue;
      const existing = await this.jobs.findDuplicates(userId, { title, company, url });
      result.existing = existing[0] ?? null;
    }
  }

  private async call<T>(action: (client: JobSpyClient) => Promise<T>): Promise<T> {
    const settings = await this.getSettings();
    const problem = validateSearchSettings(settings);
    if (problem) throw new BadRequestException(problem);
    try {
      return await action(new JobSpyClient(settings.baseUrl, settings.apiKey));
    } catch (error) {
      if (error instanceof SearchProviderError) {
        this.logger.warn(error.message);
        if (error.status === 429) {
          throw new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
        }
        if (error.status === 400) throw new BadRequestException(error.message);
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }
}
