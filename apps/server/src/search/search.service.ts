import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import { buildSearchSuggestionPrompt } from '../ai/prompts.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import type { JobDraft } from '../importers/job-draft.js';
import { JobsService, type DuplicateJob } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import { JobSpyClient, SearchProviderError, type JobSpyHealth } from './jobspy-client.js';
import { postToDraft } from './jobspy-mapping.js';
import type { SearchCandidateDto } from './search-check.dto.js';
import type { SearchJobsDto } from './search-query.dto.js';
import { parseSearchSuggestions, type SearchSuggestion } from './search-suggestions.js';
import { SEARCH_SITES, type SearchSite } from './search.constants.js';
import {
  DEFAULT_SEARCH_SETTINGS,
  proxyList,
  validateSearchSettings,
  type PublicSearchSettings,
  type SearchSettings,
  type TestSearchSettingsDto,
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
    private readonly users: UsersService,
    private readonly ai: AiService,
  ) {}

  /** Settings saved in the UI take precedence over environment variables. */
  async getSettings(): Promise<SearchSettings> {
    const saved = await this.settings.get<Partial<SearchSettings>>(SETTINGS_KEY);
    // Settings saved by an earlier version may lack the newer options.
    if (saved) return { ...DEFAULT_SEARCH_SETTINGS, ...saved };
    const { search } = this.config;
    return {
      ...DEFAULT_SEARCH_SETTINGS,
      enabled: Boolean(search.baseUrl),
      baseUrl: search.baseUrl ?? '',
      apiKey: search.apiKey ?? '',
    };
  }

  async getPublicSettings(): Promise<PublicSearchSettings> {
    const { apiKey, proxies, ...settings } = await this.getSettings();
    return {
      ...settings,
      hasApiKey: Boolean(apiKey),
      proxyCount: proxyList(proxies).length,
      configured: !validateSearchSettings({ ...settings, apiKey, proxies }),
    };
  }

  /**
   * Saves the settings. Enabling the service (or changing where it is) only succeeds if the
   * service answers, so a typo never leaves everyone with a broken Find jobs page.
   */
  async updateSettings(dto: UpdateSearchSettingsDto): Promise<PublicSearchSettings> {
    const current = await this.getSettings();
    const next = SearchService.merge(current, dto);
    next.enabled = dto.enabled;
    if (next.enabled) await this.probe(next);
    await this.settings.set<SearchSettings>(SETTINGS_KEY, next);
    return this.getPublicSettings();
  }

  /** Checks the service with the given values, or the saved ones, without saving anything. */
  async testConnection(dto: TestSearchSettingsDto = {}): Promise<SearchTestResult> {
    const current = await this.getSettings();
    return this.probe({ ...SearchService.merge(current, dto), enabled: true });
  }

  /** The saved settings with the form's values on top. Fields left out keep their saved value. */
  private static merge(
    current: SearchSettings,
    dto: Omit<UpdateSearchSettingsDto, 'enabled'>,
  ): SearchSettings {
    return {
      enabled: current.enabled,
      baseUrl: (dto.baseUrl ?? current.baseUrl).trim().replace(/\/+$/, ''),
      apiKey: dto.apiKey === undefined ? current.apiKey : dto.apiKey.trim(),
      defaultSites: dto.defaultSites?.length ? dto.defaultSites : current.defaultSites,
      country: (dto.country ?? current.country).trim(),
      distance: dto.distance === undefined ? current.distance : dto.distance,
      fetchDescriptions: dto.fetchDescriptions ?? current.fetchDescriptions,
      annualSalaries: dto.annualSalaries ?? current.annualSalaries,
      proxies: dto.proxies === undefined ? current.proxies : dto.proxies.trim(),
    };
  }

  private async probe(settings: SearchSettings): Promise<SearchTestResult> {
    const health = await this.call((client) => client.health(), settings);
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
    const posts = await this.call((client, settings) =>
      client.search(query, { ...settings, proxies: proxyList(settings.proxies) }),
    );
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

    const requested = query.sites?.length ? query.sites : (await this.getSettings()).defaultSites;
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

  /** Searches the AI proposes from the user's profile, best fit first. Nothing is run. */
  async suggest(userId: number): Promise<SearchSuggestion[]> {
    const profile = await this.users.getProfile(userId);
    if (!profile.headline.trim() && !profile.resume.trim() && !profile.preferences.trim()) {
      throw new BadRequestException(
        'Add a headline, your resume or what you are looking for to your profile first (Settings, Account).',
      );
    }
    const answer = await this.ai.complete(buildSearchSuggestionPrompt(profile));
    try {
      return parseSearchSuggestions(answer);
    } catch (error) {
      this.logger.warn(`Search suggestions unusable: ${(error as Error).message}`);
      throw new BadGatewayException((error as Error).message);
    }
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

  private async call<T>(
    action: (client: JobSpyClient, settings: SearchSettings) => Promise<T>,
    settings?: SearchSettings,
  ): Promise<T> {
    settings ??= await this.getSettings();
    const problem = validateSearchSettings(settings);
    if (problem) throw new BadRequestException(problem);
    try {
      return await action(new JobSpyClient(settings.baseUrl, settings.apiKey), settings);
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
