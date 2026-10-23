import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/configuration.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import { AiService } from './ai.service.js';

const config = { ai: {} } as AppConfig;
const fetchMock = vi.fn<typeof fetch>();

/** Answers every fetch like an OpenAI-compatible chat endpoint. A fresh Response each time. */
function reply(content: string, status = 200): void {
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('AiService settings', () => {
  let database: TestDatabase;
  let service: AiService;

  beforeEach(async () => {
    database = await createTestDatabase();
    const hunts = new HuntsService(database.db);
    const settings = new SettingsService(database.db);
    service = new AiService(
      config,
      settings,
      new JobsService(database.db, hunts),
      new UsersService(database.db, settings, hunts),
    );
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    database.client.close();
  });

  it('turns the provider off without contacting anything', async () => {
    expect(await service.updateSettings({ provider: null })).toMatchObject({
      provider: null,
      configured: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only saves a provider that answers', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      service.updateSettings({
        provider: 'openai_compatible',
        model: 'm',
        baseUrl: 'http://nowhere:1/v1',
      }),
    ).rejects.toThrow(BadGatewayException);
    expect(await service.getPublicSettings()).toMatchObject({ provider: null });

    reply('ready');
    expect(
      await service.updateSettings({
        provider: 'openai_compatible',
        model: 'm',
        baseUrl: 'http://llm:1/v1',
        apiKey: 'k',
      }),
    ).toMatchObject({ provider: 'openai_compatible', hasApiKey: true, configured: true });
    expect(String(fetchMock.mock.lastCall![0])).toBe('http://llm:1/v1/chat/completions');
  });

  it('refuses incomplete settings before trying the network', async () => {
    await expect(
      service.updateSettings({ provider: 'anthropic', model: 'claude-opus-5-5' }),
    ).rejects.toThrow(BadRequestException); // needs an API key
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tests unsaved values, keeping the saved key for the same provider', async () => {
    reply('ready');
    await service.updateSettings({
      provider: 'openai_compatible',
      model: 'm',
      baseUrl: 'http://llm:1/v1',
      apiKey: 'saved',
    });

    expect(await service.testConnection({ baseUrl: 'http://other:2/v1' })).toEqual({
      reply: 'ready',
    });
    const [url, init] = fetchMock.mock.lastCall!;
    expect(String(url)).toBe('http://other:2/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer saved');
    // Nothing was saved by the test.
    expect(await service.getPublicSettings()).toMatchObject({ baseUrl: 'http://llm:1/v1' });

    // Switching provider in the form drops the saved key, so the test reports what is missing.
    await expect(service.testConnection({ provider: 'openai', model: 'gpt' })).rejects.toThrow(
      'requires an API key',
    );
  });
});

describe('AiService.runTask', () => {
  let database: TestDatabase;
  let service: AiService;
  let jobs: JobsService;
  let users: UsersService;
  let alice: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    const hunts = new HuntsService(database.db);
    const settings = new SettingsService(database.db);
    jobs = new JobsService(database.db, hunts);
    users = new UsersService(database.db, settings, hunts);
    service = new AiService(config, settings, jobs, users);
    alice = await database.createUser('alice');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    reply('ready');
    await service.updateSettings({
      provider: 'openai_compatible',
      model: 'm',
      baseUrl: 'http://llm:1/v1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    database.client.close();
  });

  const lastPrompt = () => {
    const body = JSON.parse(String(fetchMock.mock.lastCall![1]?.body)) as {
      messages: { content: string }[];
    };
    return body.messages.at(-1)!.content;
  };

  it('writes the cover letter from the profile, or from the details saved on the job', async () => {
    await users.updateProfile(alice, { name: 'Alice', resume: 'General resume' });
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme', description: 'x' });

    reply('Dear team');
    expect(await service.runTask(alice, job.id, 'cover-letter')).toMatchObject({
      coverLetter: 'Dear team',
    });
    expect(lastPrompt()).toContain('General resume');

    await jobs.update(alice, job.id, { profile: { resume: 'Tailored resume' } });
    await service.runTask(alice, job.id, 'cover-letter');
    expect(lastPrompt()).toContain('Name: Alice');
    expect(lastPrompt()).toContain('Tailored resume');
    expect(lastPrompt()).not.toContain('General resume');
  });
});

describe('AiService.tidyResume', () => {
  let database: TestDatabase;
  let service: AiService;

  beforeEach(async () => {
    database = await createTestDatabase();
    const hunts = new HuntsService(database.db);
    const settings = new SettingsService(database.db);
    service = new AiService(
      config,
      settings,
      new JobsService(database.db, hunts),
      new UsersService(database.db, settings, hunts),
    );
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    reply('ready');
    await service.updateSettings({
      provider: 'openai_compatible',
      model: 'm',
      baseUrl: 'http://llm:1/v1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    database.client.close();
  });

  it('sends the resume and returns the cleaned text without a code fence', async () => {
    reply('```text\nJANE DOE\r\n\r\n\r\n- Built things  \n```');
    expect(await service.tidyResume('Jane Doe Built things')).toBe('JANE DOE\n\n- Built things');
    const body = JSON.parse(String(fetchMock.mock.lastCall![1]?.body)) as {
      messages: { content: string }[];
    };
    expect(body.messages.at(-1)?.content).toContain('<resume>\nJane Doe Built things\n</resume>');
  });

  it('needs a provider', async () => {
    await service.updateSettings({ provider: null });
    await expect(service.tidyResume('Jane')).rejects.toThrow(BadRequestException);
  });
});
