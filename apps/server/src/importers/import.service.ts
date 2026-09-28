import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AiService } from '../ai/ai.service.js';
import { HttpFetcher } from './http-fetcher.js';
import type { ImportJobDto } from './import-job.dto.js';
import { fillMissing, isComplete, type JobDraft } from './job-draft.js';
import type { JobParser } from './job-parser.js';
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

    if (dto.text) {
      result.draft.description = dto.text.trim();
    } else {
      await this.runParsers(new LazyPageContext(this.fetcher, url, dto.html), parsers, result);
    }

    if (dto.useAi && !isComplete(result.draft)) {
      await this.fillWithAi(dto, result);
    }

    if (!result.draft.title && !result.draft.description) {
      throw new UnprocessableEntityException(
        result.warnings[0] ?? 'No job details were found on that page',
      );
    }

    result.draft.url ??= url?.toString();
    return result;
  }

  private async runParsers(
    page: LazyPageContext,
    parsers: readonly JobParser[],
    result: ImportResult,
  ): Promise<void> {
    for (const parser of parsers.filter((candidate) => candidate.matches(page.url))) {
      try {
        const draft = await parser.parse(page);
        if (!draft) continue;
        const source = parser.site ?? page.url?.hostname.replace(/^www\./, '');
        result.draft = fillMissing(result.draft, { source, ...draft });
        result.sources.push(parser.id);
      } catch (error) {
        this.logger.warn(`${parser.id} parser failed: ${(error as Error).message}`);
        result.warnings.push(`${parser.site ?? parser.id}: ${(error as Error).message}`);
      }
      if (isComplete(result.draft)) break;
    }
  }

  private async fillWithAi(dto: ImportJobDto, result: ImportResult): Promise<void> {
    const text = dto.text ?? ImportService.pageText(dto.html) ?? result.draft.description;
    if (!text) return;
    try {
      const extracted = await this.ai.extractJob(text);
      result.draft = fillMissing(result.draft, extracted);
      result.sources.push('ai');
    } catch (error) {
      result.warnings.push(`AI: ${(error as Error).message}`);
    }
  }

  private static pageText(html: string | undefined): string | undefined {
    if (!html) return undefined;
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, nav, footer, header').remove();
    return $('body').text().replace(/\s+/g, ' ').trim() || undefined;
  }
}
