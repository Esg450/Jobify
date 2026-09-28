import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AiService } from '../ai/ai.service.js';
import { HttpFetcher } from './http-fetcher.js';
import type { ImportJobDto } from './import-job.dto.js';
import { fillMissing, isComplete, type JobDraft } from './job-draft.js';
import type { JobParser } from './job-parser.js';
import { findEmbeddedPosting } from './embedded-posting.js';
import { LazyPageContext } from './page-context.js';
import { JOB_PARSERS } from './parsers/index.js';

export interface ImportResult {
  draft: JobDraft;
  /** Ids of the parsers (and "ai") that contributed fields. */
  sources: string[];
  warnings: string[];
}

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
    const url = dto.url ? new URL(dto.url) : undefined;
    const result: ImportResult = { draft: {}, sources: [], warnings: [] };
    const page = new LazyPageContext(this.fetcher, url, dto.html);
    let onlyGuesses = true;

    if (dto.text) {
      result.draft.description = dto.text.trim();
    } else {
      const target = (await this.findEmbeddedPosting(page, parsers, result)) ?? page;
      onlyGuesses = await this.runParsers(target, parsers, result);
    }

    // Guesses from the page title are not worth keeping when AI can read the page instead.
    if (dto.useAi && (onlyGuesses || !isComplete(result.draft))) {
      const text = dto.text ?? (await ImportService.pageText(page)) ?? result.draft.description;
      if (text) await this.fillWithAi(text, result, onlyGuesses);
    }

    if (!result.draft.title && !result.draft.description) {
      throw new UnprocessableEntityException(
        result.warnings[0] ?? 'No job details were found on that page',
      );
    }

    result.draft.url ??= url?.toString();
    return result;
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

  private async fillWithAi(text: string, result: ImportResult, overrideGuesses: boolean) {
    try {
      const extracted = await this.ai.extractJob(text);
      result.draft = overrideGuesses
        ? fillMissing(extracted, result.draft)
        : fillMissing(result.draft, extracted);
      result.sources.push('ai');
    } catch (error) {
      this.logger.warn(`AI extraction failed: ${(error as Error).message}`);
      result.warnings.push(`AI: ${(error as Error).message}`);
    }
  }

  /** The page's readable text for AI extraction, without scripts and page furniture. */
  private static async pageText(page: LazyPageContext): Promise<string | undefined> {
    const html = await page.html().catch(() => undefined);
    if (!html) return undefined;
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, nav, footer, header').remove();
    return $('body').text().replace(/\s+/g, ' ').trim() || undefined;
  }
}
