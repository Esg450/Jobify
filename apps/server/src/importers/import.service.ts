import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AiService } from '../ai/ai.service.js';
import { findEmbeddedPosting } from './embedded-posting.js';
import { enrichDraft } from './enrich.js';
import { HttpFetcher } from './http-fetcher.js';
import type { ImportJobDto } from './import-job.dto.js';
import { fillMissing, isComplete, type JobDraft } from './job-draft.js';
import type { JobParser } from './job-parser.js';
import { LazyPageContext } from './page-context.js';
import { looksLikeJobListing, removePageFurniture, urlFromHtml } from './page-signals.js';
import { JOB_PARSERS } from './parsers/index.js';
import { draftFromText } from './text-draft.js';
import { isListingTitle } from './text-signals.js';

export interface ImportResult {
  draft: JobDraft;
  /** Ids of the parsers (and "ai") that contributed fields. */
  sources: string[];
  warnings: string[];
}

const LISTING_MESSAGE =
  'This page lists several jobs rather than one posting. Open the job you want and import that page instead.';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly fetcher: HttpFetcher,
    private readonly ai: AiService,
  ) {}

  /** The sites with dedicated parsers, for display in the UI. */
  supportedSites(parsers: readonly JobParser[] = JOB_PARSERS) {
    return parsers.flatMap(({ id, site }) => (site ? [{ id, name: site }] : []));
  }

  async import(
    dto: ImportJobDto,
    parsers: readonly JobParser[] = JOB_PARSERS,
  ): Promise<ImportResult> {
    const url = dto.url ? new URL(dto.url) : ImportService.urlFromPastedHtml(dto.html);
    const result: ImportResult = { draft: {}, sources: [], warnings: [] };
    const page = new LazyPageContext(this.fetcher, url, dto.html);
    let onlyGuesses = true;

    if (dto.text) {
      result.draft = draftFromText(dto.text);
      result.sources.push('text');
    } else {
      const target = (await this.findEmbeddedPosting(page, parsers, result)) ?? page;
      onlyGuesses = await this.runParsers(target, parsers, result);
    }

    // Guesses from the page title are not worth keeping when AI can read the page instead.
    if (dto.useAi && (onlyGuesses || !isComplete(result.draft))) {
      const text = dto.text ?? (await ImportService.pageText(page)) ?? result.draft.description;
      if (text && (await this.fillWithAi(text, result, onlyGuesses))) onlyGuesses = false;
    }

    if (onlyGuesses && !dto.text && (await this.isJobListing(page))) {
      throw new UnprocessableEntityException(LISTING_MESSAGE);
    }
    if (!result.draft.title && !result.draft.description) {
      throw new UnprocessableEntityException(
        result.warnings[0] ?? 'No job details were found on that page',
      );
    }

    result.draft = enrichDraft(result.draft);
    result.draft.url ??= url?.toString();
    return result;
  }

  /** Pasted page source usually names its own address, which lets the site parsers run. */
  private static urlFromPastedHtml(html: string | undefined): URL | undefined {
    if (!html) return undefined;
    return urlFromHtml(html, cheerio.load(html));
  }

  /**
   * When a careers page embeds its posting from an applicant tracking system, returns a page
   * for the posting on the ATS so the dedicated parser can read it.
   */
  private async findEmbeddedPosting(
    page: LazyPageContext,
    parsers: readonly JobParser[],
    result: ImportResult,
  ): Promise<LazyPageContext | undefined> {
    if (parsers.some((parser) => parser.site && parser.matches(page.url))) return undefined;

    let html: string;
    try {
      html = await page.html();
    } catch {
      return undefined; // The parsers will report why the page could not be loaded.
    }

    const embedded = findEmbeddedPosting(html, page.url);
    if (!embedded) return undefined;
    this.logger.log(`Following embedded posting ${embedded}`);
    result.sources.push('embedded');
    return new LazyPageContext(this.fetcher, new URL(embedded));
  }

  /** Runs the matching parsers. Returns true if only fallback parsers found anything. */
  private async runParsers(
    page: LazyPageContext,
    parsers: readonly JobParser[],
    result: ImportResult,
  ): Promise<boolean> {
    let onlyGuesses = true;
    for (const parser of parsers.filter((candidate) => candidate.matches(page.url))) {
      try {
        const draft = await parser.parse(page);
        if (!draft) continue;
        const source = parser.site ?? page.url?.hostname.replace(/^www\./, '');
        result.draft = fillMissing(result.draft, { source, ...draft });
        result.sources.push(parser.id);
        if (!parser.fallback) onlyGuesses = false;
      } catch (error) {
        this.logger.warn(`${parser.id} parser failed: ${(error as Error).message}`);
        result.warnings.push(`${parser.site ?? parser.id}: ${(error as Error).message}`);
      }
      if (isComplete(result.draft)) break;
    }
    return onlyGuesses;
  }

  /** Returns true when the AI contributed fields. */
  private async fillWithAi(
    text: string,
    result: ImportResult,
    overrideGuesses: boolean,
  ): Promise<boolean> {
    try {
      const extracted = await this.ai.extractJob(text);
      result.draft = overrideGuesses
        ? fillMissing(extracted, result.draft)
        : fillMissing(result.draft, extracted);
      result.sources.push('ai');
      return Boolean(extracted.title || extracted.description);
    } catch (error) {
      this.logger.warn(`AI extraction failed: ${(error as Error).message}`);
      result.warnings.push(`AI: ${(error as Error).message}`);
      return false;
    }
  }

  private async isJobListing(page: LazyPageContext): Promise<boolean> {
    const $ = await page.document().catch(() => undefined);
    return $ ? looksLikeJobListing($, page.url) || isListingTitle($('title').text()) : false;
  }

  /** The page's readable text for AI extraction, without scripts and page furniture. */
  private static async pageText(page: LazyPageContext): Promise<string | undefined> {
    const html = await page.html().catch(() => undefined);
    if (!html) return undefined;
    const $ = cheerio.load(html);
    removePageFurniture($);
    $('header').remove();
    return $('body').text().replace(/\s+/g, ' ').trim() || undefined;
  }
}
