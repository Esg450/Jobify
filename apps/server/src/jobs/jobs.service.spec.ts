import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { today } from '../common/dates.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  let database: TestDatabase;
  let jobs: JobsService;
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    jobs = new JobsService(database.db);
    alice = await database.createUser('alice');
    bob = await database.createUser('bob');
  });

  afterEach(() => database.client.close());

  it('records a created event and leaves saved jobs without an applied date', async () => {
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    expect(job.status).toBe('saved');
    expect(job.appliedOn).toBeNull();
    expect(job.events.map((event) => event.type)).toEqual(['created']);
  });

  it('defaults the applied date when a job is created as applied', async () => {
    const job = await jobs.create(alice, { title: 'Engineer', company: 'Acme', status: 'applied' });
    expect(job.appliedOn).toBe(today());
  });

  it('logs status changes and sets the applied date on the first move out of saved', async () => {
    const { id } = await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    const updated = await jobs.update(alice, id, { status: 'applied' });

    expect(updated.appliedOn).toBe(today());
    expect(updated.events[0]).toMatchObject({
      type: 'status_change',
      fromStatus: 'saved',
      toStatus: 'applied',
    });

    const unchanged = await jobs.update(alice, id, { status: 'applied', notes: 'Followed up' });
    expect(unchanged.events).toHaveLength(2);
  });

  it('filters and searches the list', async () => {
    await jobs.create(alice, {
      title: 'Frontend Engineer',
      company: 'Acme',
      workplaceType: 'remote',
    });
    await jobs.create(alice, { title: 'Designer', company: 'Globex', status: 'applied' });
    await jobs.create(alice, { title: 'Old role', company: 'Initech', archived: true });

    const companies = async (query: Parameters<JobsService['list']>[1]) =>
      (await jobs.list(alice, query)).map((job) => job.company);

    expect((await companies({})).sort()).toEqual(['Acme', 'Globex']);
    expect(await companies({ q: 'front' })).toEqual(['Acme']);
    expect(await companies({ status: ['applied'] })).toEqual(['Globex']);
    expect(await companies({ workplaceType: ['remote'] })).toEqual(['Acme']);
    expect(await companies({ archived: true })).toEqual(['Initech']);
    expect(await companies({ sort: 'company', order: 'desc' })).toEqual(['Globex', 'Acme']);
  });

  it("keeps each user's jobs private", async () => {
    const { id } = await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    await jobs.create(bob, { title: 'Chef', company: 'Bistro' });

    expect((await jobs.list(alice, {})).map((job) => job.company)).toEqual(['Acme']);
    expect((await jobs.list(bob, {})).map((job) => job.company)).toEqual(['Bistro']);

    await expect(jobs.findOne(bob, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(jobs.update(bob, id, { title: 'Hijacked' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(jobs.remove(bob, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(jobs.addEvent(bob, id, { type: 'note' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect((await jobs.findOne(alice, id)).title).toBe('Engineer');
  });

  it('returns status history and interviews for the timeline', async () => {
    const { id } = await jobs.create(alice, {
      title: 'Engineer',
      company: 'Acme',
      status: 'applied',
    });
    await jobs.update(alice, id, { status: 'interviewing' });
    await jobs.addEvent(alice, id, {
      type: 'interview',
      title: 'Onsite',
      occurredAt: '2026-10-05T10:00:00.000Z',
    });
    await jobs.addEvent(alice, id, { type: 'note', body: 'Not on the timeline' });
    await jobs.create(alice, { title: 'Old', company: 'Initech', archived: true });
    await jobs.create(bob, { title: 'Chef', company: 'Bistro' });

    const timeline = await jobs.timeline(alice, false);
    expect(timeline.map((job) => job.company)).toEqual(['Acme']);
    expect(timeline[0].events.map((event) => [event.type, event.toStatus ?? event.title])).toEqual([
      ['created', 'applied'],
      ['status_change', 'interviewing'],
      ['interview', 'Onsite'],
    ]);
    expect((await jobs.timeline(alice, true)).map((job) => job.company)).toEqual([
      'Acme',
      'Initech',
    ]);
  });

  it('manages timeline events and deletes them with the job', async () => {
    const { id } = await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    const interview = await jobs.addEvent(alice, id, {
      type: 'interview',
      title: 'Phone screen',
      occurredAt: '2026-10-01T15:00:00.000Z',
    });

    const edited = await jobs.updateEvent(alice, id, interview.id, {
      body: 'With the hiring manager',
    });
    expect(edited.body).toBe('With the hiring manager');

    await jobs.remove(alice, id);
    await expect(jobs.findOne(alice, id)).rejects.toBeInstanceOf(NotFoundException);
    const { rows } = await database.client.execute('SELECT COUNT(*) AS count FROM job_events');
    expect(rows[0].count).toBe(0);
  });
});
