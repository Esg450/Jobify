import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import type { AiService } from './ai.service.js';
import { CHAT_HISTORY_LIMIT } from './chat-prompt.js';
import { ChatService } from './chat.service.js';
import type { CompletionRequest } from './providers/ai-provider.js';

describe('ChatService', () => {
  let database: TestDatabase;
  let jobs: JobsService;
  let users: UsersService;
  let chat: ChatService;
  let requests: CompletionRequest[];
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    const hunts = new HuntsService(database.db);
    jobs = new JobsService(database.db, hunts);
    users = new UsersService(database.db, new SettingsService(database.db), hunts);
    requests = [];
    const ai = {
      complete: async (request: CompletionRequest) => {
        requests.push(request);
        return `Answer ${requests.length}`;
      },
    } as unknown as AiService;
    chat = new ChatService(database.db, jobs, users, ai);
    alice = await database.createUser('alice');
    bob = await database.createUser('bob');
  });

  afterEach(() => database.client.close());

  it('sends the posting, profile and earlier turns with each question', async () => {
    const job = await jobs.create(alice, {
      title: 'Engineer',
      company: 'Acme',
      description: 'Build rockets',
    });
    await users.updateProfile(alice, { resume: 'Ten years of rockets' });

    const first = await chat.ask(alice, job.id, 'Why do I want to work here?');
    expect(first).toMatchObject([
      { role: 'user', content: 'Why do I want to work here?' },
      { role: 'assistant', content: 'Answer 1' },
    ]);
    expect(requests[0].system).toContain('Build rockets');
    expect(requests[0].system).toContain('Ten years of rockets');
    expect(requests[0].history).toEqual([]);
    expect(requests[0].prompt).toBe('Why do I want to work here?');

    const second = await chat.ask(alice, job.id, 'Make it shorter');
    expect(second).toHaveLength(4);
    expect(requests[1].history).toEqual([
      { role: 'user', content: 'Why do I want to work here?' },
      { role: 'assistant', content: 'Answer 1' },
    ]);
    expect(await chat.list(alice, job.id)).toEqual(second);
  });

  it('only sends the most recent turns of a long conversation', async () => {
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme', description: 'x' });
    for (let i = 0; i < CHAT_HISTORY_LIMIT; i++) await chat.ask(alice, job.id, `Question ${i}`);

    await chat.ask(alice, job.id, 'Latest');
    const { history } = requests.at(-1)!;
    expect(history).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(history![0].content).toBe(`Question ${CHAT_HISTORY_LIMIT / 2}`);
    expect(history!.at(-1)!.content).toBe(`Answer ${CHAT_HISTORY_LIMIT}`);
  });

  it('requires a description and saves nothing when the provider fails', async () => {
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    await expect(chat.ask(alice, job.id, 'Hi')).rejects.toThrow(BadRequestException);
    expect(await chat.list(alice, job.id)).toEqual([]);

    await jobs.update(alice, job.id, { description: 'Build rockets' });
    const failing = { complete: () => Promise.reject(new Error('down')) } as unknown as AiService;
    const broken = new ChatService(database.db, jobs, users, failing);
    await expect(broken.ask(alice, job.id, 'Hi')).rejects.toThrow('down');
    expect(await chat.list(alice, job.id)).toEqual([]);
  });

  it('keeps conversations private and clears them with the job', async () => {
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme', description: 'x' });
    await chat.ask(alice, job.id, 'Hello');

    await expect(chat.list(bob, job.id)).rejects.toThrow(NotFoundException);
    await expect(chat.ask(bob, job.id, 'Hello')).rejects.toThrow(NotFoundException);
    await expect(chat.clear(bob, job.id)).rejects.toThrow(NotFoundException);
    expect(await chat.list(alice, job.id)).toHaveLength(2);

    await chat.clear(alice, job.id);
    expect(await chat.list(alice, job.id)).toEqual([]);

    await chat.ask(alice, job.id, 'Hello again');
    await jobs.remove(alice, job.id);
    const rows = await database.client.execute('select count(*) as n from job_chat_messages');
    expect(rows.rows[0].n).toBe(0);
  });
});
