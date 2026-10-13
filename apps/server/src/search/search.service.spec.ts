import { BadGatewayException, BadRequestException, HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/configuration.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { JobSpyPost } from './jobspy-client.js';
import { SearchService } from './search.service.js';

const config = { search: { baseUrl: undefined, apiKey: undefined } } as AppConfig;

function post(overrides: Partial<JobSpyPost> = {}): JobSpyPost {
  return {
    id: 'li-1',
    site: 'linkedin',
    job_url: 'https://www.linkedin.com/jobs/view/1?refId=abc',
    title: 'Data Engineer',
    company: 'Globex',
    location: 'Remote',
    date_posted: '2026-10-10',
    job_type: null,
    is_remote: true,
    interval: null,
    min_amount: null,
    max_amount: null,
    currency: null,
    description: null,
    ...overrides,
  };
}

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Answers every fetch with this JSON. A fresh Response each time: a body can only be read once. */
function respondWith(body: unknown, status = 200): void {
  fetchMock.mockImplementation(async () => jsonResponse(body, status));
}

describe('SearchService', () => {
  let database: TestDatabase;
  let service: SearchService;
  let jobs: JobsService;
  let alice: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    jobs = new JobsService(database.db, new HuntsService(database.db));
    service = new SearchService(config, new SettingsService(database.db), jobs);
    alice = await database.createUser('alice', 'admin');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    database.client.close();
  });

  it('is off until an admin enables it', async () => {
    expect(await service.getPublicSettings()).toEqual({
      enabled: false,
      baseUrl: '',
      hasApiKey: false,
      proxyCount: 0,
      configured: false,
      defaultSites: ['indeed', 'linkedin'],
      country: '',
      distance: null,
      fetchDescriptions: false,
      annualSalaries: false,
    });
    await expect(service.search(alice, { terms: 'engineer' })).rejects.toThrow(BadRequestException);
  });

  it('defaults to the environment when nothing is saved', async () => {
    const fromEnv = new SearchService(
      { search: { baseUrl: 'http://jobspy:8000', apiKey: 'k' } } as AppConfig,
      new SettingsService(database.db),
      jobs,
    );
    expect(await fromEnv.getPublicSettings()).toMatchObject({
      enabled: true,
      baseUrl: 'http://jobspy:8000',
      hasApiKey: true,
      configured: true,
    });
  });

  it('saves settings, keeps the key unless replaced and never returns it', async () => {
    respondWith({ status: 'ok' });
    expect(
      await service.updateSettings({
        enabled: true,
        baseUrl: 'http://192.168.1.10:8000/',
        apiKey: 'secret',
      }),
    ).toMatchObject({
      enabled: true,
      baseUrl: 'http://192.168.1.10:8000',
      hasApiKey: true,
      configured: true,
    });

    await service.updateSettings({ enabled: true });
    expect(await service.getSettings()).toMatchObject({ apiKey: 'secret' });

    // Turning it off never contacts the service and drops the key when asked to.
    fetchMock.mockReset();
    await service.updateSettings({ enabled: false, apiKey: '' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await service.getPublicSettings()).toMatchObject({
      hasApiKey: false,
      configured: false,
    });
  });

  it('refuses to enable the service without a usable URL', async () => {
    await expect(service.updateSettings({ enabled: true, baseUrl: '' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.updateSettings({ enabled: true, baseUrl: 'jobspy:8000' })).rejects.toThrow(
      'http://',
    );
  });

  it('does not save a service that does not answer', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      service.updateSettings({ enabled: true, baseUrl: 'http://nowhere:8000' }),
    ).rejects.toThrow(BadGatewayException);
    expect(await service.getPublicSettings()).toMatchObject({ enabled: false, baseUrl: '' });

    respondWith({ detail: 'Invalid or missing API key' }, 403);
    await expect(
      service.updateSettings({ enabled: true, baseUrl: 'http://jobspy:8000', apiKey: 'wrong' }),
    ).rejects.toThrow('rejected the API key');
    expect(await service.getPublicSettings()).toMatchObject({ enabled: false });
  });

  it('tests unsaved values, falling back to the saved key', async () => {
    respondWith({ status: 'ok', jobspy: '1.3.0', sites: [] });
    await service.updateSettings({ enabled: true, baseUrl: 'http://jobspy:8000', apiKey: 'saved' });

    expect(await service.testConnection({ baseUrl: 'http://other:9000/' })).toEqual({
      version: '1.3.0',
      sites: [],
    });
    const [url, init] = fetchMock.mock.lastCall!;
    expect(String(url)).toBe('http://other:9000/health');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('saved');
    // Nothing was saved by the test.
    expect(await service.getPublicSettings()).toMatchObject({ baseUrl: 'http://jobspy:8000' });

    await expect(service.testConnection({ baseUrl: '' })).rejects.toThrow(BadRequestException);
  });

  describe('with a configured service', () => {
    beforeEach(async () => {
      respondWith({ status: 'ok' });
      await service.updateSettings({
        enabled: true,
        baseUrl: 'http://jobspy:8000',
        apiKey: 'secret',
      });
      fetchMock.mockReset();
    });

    it('reports the version and sites on a successful test', async () => {
      respondWith({ status: 'ok', jobspy: '1.3.0', sites: ['indeed', 'linkedin'] });
      expect(await service.testConnection()).toEqual({
        version: '1.3.0',
        sites: ['indeed', 'linkedin'],
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('http://jobspy:8000/health');
      expect((init?.headers as Record<string, string>)['x-api-key']).toBe('secret');
    });

    it('sends the query as JobSpy parameters and marks jobs the user already has', async () => {
      await jobs.create(alice, {
        title: 'data engineer',
        company: 'GLOBEX',
        url: 'https://www.linkedin.com/jobs/view/1',
      });
      respondWith({
        count: 3,
        jobs: [
          post(),
          post({
            id: 'in-2',
            site: 'indeed',
            job_url: 'https://www.indeed.com/viewjob?jk=2',
            title: 'Analytics Engineer',
            company: 'Initech',
          }),
          post({ id: 'in-3', site: 'indeed', title: null }),
        ],
      });

      const { results, warnings } = await service.search(alice, {
        terms: 'data engineer',
        location: 'Austin, TX',
        sites: ['linkedin', 'indeed'],
        remote: true,
        hoursOld: 72,
        jobType: 'fulltime',
        limit: 30,
      });

      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.pathname).toBe('/api/v1/search_jobs');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        search_term: 'data engineer',
        site_name: 'linkedin,indeed',
        results_wanted: '30',
        description_format: 'markdown',
        location: 'Austin, TX',
        is_remote: 'true',
        hours_old: '72',
        job_type: 'fulltime',
      });

      expect(results).toHaveLength(2); // the row without a title is dropped
      expect(results[0]).toMatchObject({
        id: 'li-1',
        site: 'linkedin',
        draft: { title: 'Data Engineer', company: 'Globex', workplaceType: 'remote' },
        existing: { title: 'data engineer', company: 'GLOBEX' },
      });
      expect(results[1]).toMatchObject({ id: 'in-2', existing: null });
      expect(warnings).toEqual([]);
    });

    it('applies the saved search defaults and never returns the proxies', async () => {
      respondWith({ status: 'ok' });
      const saved = await service.updateSettings({
        enabled: true,
        defaultSites: ['glassdoor'],
        country: 'UK',
        distance: 25,
        fetchDescriptions: true,
        annualSalaries: true,
        proxies: 'user:pass@proxy-a:8080\n user:pass@proxy-b:8080 ',
      });
      expect(saved).toMatchObject({ defaultSites: ['glassdoor'], country: 'UK', proxyCount: 2 });
      expect(saved).not.toHaveProperty('proxies');

      respondWith({ count: 0, jobs: [] });
      const { warnings } = await service.search(alice, { terms: 'x' });
      const url = new URL(String(fetchMock.mock.lastCall![0]));
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        site_name: 'glassdoor',
        country_indeed: 'UK',
        distance: '25',
        fetch_description: 'true',
        enforce_annual_salary: 'true',
        proxies: 'user:pass@proxy-a:8080,user:pass@proxy-b:8080',
      });
      expect(warnings).toEqual([expect.stringContaining('Glassdoor')]);

      // A search's own country and boards win over the defaults.
      await service.search(alice, { terms: 'x', sites: ['indeed'], country: 'Canada' });
      const next = new URL(String(fetchMock.mock.lastCall![0]));
      expect(next.searchParams.get('site_name')).toBe('indeed');
      expect(next.searchParams.get('country_indeed')).toBe('Canada');
    });

    it('warns about boards that returned nothing', async () => {
      respondWith({ count: 1, jobs: [post()] });
      const { warnings } = await service.search(alice, {
        terms: 'x',
        sites: ['linkedin', 'glassdoor'],
      });
      expect(warnings).toEqual([expect.stringContaining('Glassdoor returned no results')]);
    });

    it('re-checks earlier results against the jobs saved since', async () => {
      await jobs.create(alice, { title: 'Data Engineer', company: 'Globex' });
      expect(
        await service.check(alice, [
          { id: 'a', title: 'data engineer', company: 'globex' },
          { id: 'b', title: 'Analytics Engineer', company: 'Initech', url: 'https://x.test/1' },
        ]),
      ).toEqual({ a: expect.objectContaining({ title: 'Data Engineer' }), b: null });
    });

    it('turns service failures into the right HTTP errors', async () => {
      respondWith({ detail: 'Invalid or missing API key' }, 403);
      await expect(service.testConnection()).rejects.toThrow('rejected the API key');

      fetchMock.mockResolvedValue(new Response('slow down', { status: 429 }));
      await expect(service.search(alice, { terms: 'x' })).rejects.toSatisfy(
        (error) => error instanceof HttpException && error.getStatus() === 429,
      );

      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.search(alice, { terms: 'x' })).rejects.toThrow(BadGatewayException);

      fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
      await expect(service.search(alice, { terms: 'x' })).rejects.toThrow('did not return JSON');
    });
  });
});
