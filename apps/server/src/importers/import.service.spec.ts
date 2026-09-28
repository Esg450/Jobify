import { describe, expect, it, vi } from 'vitest';
import type { AiService } from '../ai/ai.service.js';
import type { HttpFetcher } from './http-fetcher.js';
import type { JobDraft } from './job-draft.js';
import type { JobParser } from './job-parser.js';
import { ImportService } from './import.service.js';

function parser(
  id: string,
  result: JobDraft | null | Error,
  site?: string,
  options: Partial<JobParser> = {},
): JobParser {
  return {
    id,
    site,
    matches: () => true,
    ...options,
    parse: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
}

function createService(extractJob = vi.fn(), pageHtml = '<html></html>') {
  const fetcher = { text: vi.fn().mockResolvedValue(pageHtml) } as unknown as HttpFetcher;
  const ai = { extractJob } as unknown as AiService;
  return { service: new ImportService(fetcher, ai), extractJob };
}

describe('ImportService', () => {
  it('lets earlier parsers win and later parsers fill the gaps', async () => {
    const { service } = createService();
    const result = await service.import({ url: 'https://www.example.com/jobs/1' }, [
      parser('site', { title: 'Engineer', location: 'Paris' }, 'Example'),
      parser('generic', { title: 'Ignored', company: 'Example Inc', description: 'Build.' }),
    ]);

    expect(result.draft).toEqual({
      source: 'Example',
      title: 'Engineer',
      location: 'Paris',
      company: 'Example Inc',
      description: 'Build.',
      url: 'https://www.example.com/jobs/1',
    });
    expect(result.sources).toEqual(['site', 'generic']);
  });

  it('stops once the draft is complete', async () => {
    const { service } = createService();
    const later = parser('later', { location: 'Nowhere' });
    const parse = vi.spyOn(later, 'parse');

    await service.import({ url: 'https://example.com/job' }, [
      parser('first', { title: 'A', company: 'B', description: 'C' }),
      later,
    ]);
    expect(parse).not.toHaveBeenCalled();
  });

  it('uses the hostname as the source for generic parsers', async () => {
    const { service } = createService();
    const result = await service.import({ url: 'https://www.careers.example.com/1' }, [
      parser('generic', { title: 'A', company: 'B', description: 'C' }),
    ]);
    expect(result.draft.source).toBe('careers.example.com');
  });

  it('records parser failures as warnings and keeps going', async () => {
    const { service } = createService();
    const result = await service.import({ url: 'https://example.com/job' }, [
      parser('broken', new Error('boom'), 'Broken'),
      parser('generic', { title: 'A', company: 'B', description: 'C' }),
    ]);
    expect(result.warnings).toEqual(['Broken: boom']);
    expect(result.draft.title).toBe('A');
  });

  it('fills missing fields with AI when requested', async () => {
    const { service, extractJob } = createService(
      vi.fn().mockResolvedValue({ title: 'From AI', company: 'AI Co' }),
    );
    const result = await service.import({ text: 'Senior chef wanted at AI Co', useAi: true }, []);

    expect(extractJob).toHaveBeenCalledWith('Senior chef wanted at AI Co');
    expect(result.draft).toMatchObject({
      title: 'From AI',
      company: 'AI Co',
      description: 'Senior chef wanted at AI Co',
    });
    expect(result.sources).toEqual(['ai']);
  });

  it('fails when nothing useful was found', async () => {
    const { service } = createService();
    await expect(
      service.import({ url: 'https://example.com/job' }, [parser('generic', null)]),
    ).rejects.toThrow('No job details were found on that page');
  });

  it('follows a posting embedded from an applicant tracking system', async () => {
    const careersPage =
      '<iframe src="https://jobs.ashbyhq.com/acme/440fd260-b06a-42e0-b89e-99e966b317dc"></iframe>';
    const { service } = createService(vi.fn(), careersPage);
    const ashby = parser(
      'ashby',
      { title: 'DevOps Engineer', description: 'Run things.' },
      'Ashby',
      {
        matches: (url) => url?.hostname === 'jobs.ashbyhq.com',
      },
    );

    const result = await service.import({ url: 'https://www.acme.com/careers' }, [ashby]);
    expect(result.draft).toMatchObject({ title: 'DevOps Engineer', source: 'Ashby' });
    expect(result.sources).toEqual(['embedded', 'ashby']);
  });

  it('lets AI replace guesses from the page title', async () => {
    const { service, extractJob } = createService(
      vi
        .fn()
        .mockResolvedValue({ title: 'DevOps Engineer', company: 'Acme', description: 'Real.' }),
      '<html><body><p>Senior DevOps Engineer at Acme</p></body></html>',
    );
    const guess = parser(
      'meta-tags',
      { title: 'Acme Careers', company: 'Acme', description: 'Join us!' },
      undefined,
      {
        fallback: true,
      },
    );

    const result = await service.import({ url: 'https://acme.com/careers', useAi: true }, [guess]);
    // The AI reads the downloaded page, not just the guessed description.
    expect(extractJob).toHaveBeenCalledWith('Senior DevOps Engineer at Acme');
    expect(result.draft).toMatchObject({ title: 'DevOps Engineer', description: 'Real.' });
  });

  it('keeps fields from real parsers over AI output', async () => {
    const { service } = createService(
      vi.fn().mockResolvedValue({ title: 'AI title', location: 'Paris' }),
      '<html><body>Engineer at Acme, Paris</body></html>',
    );
    const result = await service.import({ url: 'https://acme.com/job', useAi: true }, [
      parser('json-ld', { title: 'Structured title', company: 'Acme' }),
    ]);
    expect(result.draft).toMatchObject({ title: 'Structured title', location: 'Paris' });
  });
});
