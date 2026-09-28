import { NotFoundException } from '@nestjs/common';
import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { today } from '../common/dates.js';
import { openDatabase } from '../database/database.js';
import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  let client: Client;
  let jobs: JobsService;

  beforeEach(async () => {
    const connection = await openDatabase(':memory:');
    client = connection.client;
    jobs = new JobsService(connection.db);
  });

  afterEach(() => client.close());

  it('records a created event and leaves saved jobs without an applied date', async () => {
    const job = await jobs.create({ title: 'Engineer', company: 'Acme' });
    expect(job.status).toBe('saved');
    expect(job.appliedOn).toBeNull();
    expect(job.events.map((event) => event.type)).toEqual(['created']);
  });

  it('defaults the applied date when a job is created as applied', async () => {
    const job = await jobs.create({ title: 'Engineer', company: 'Acme', status: 'applied' });
    expect(job.appliedOn).toBe(today());
  });

  it('logs status changes and sets the applied date on the first move out of saved', async () => {
    const { id } = await jobs.create({ title: 'Engineer', company: 'Acme' });
    const updated = await jobs.update(id, { status: 'applied' });

    expect(updated.appliedOn).toBe(today());
    expect(updated.events[0]).toMatchObject({
      type: 'status_change',
      fromStatus: 'saved',
      toStatus: 'applied',
    });

    const unchanged = await jobs.update(id, { status: 'applied', notes: 'Followed up' });
    expect(unchanged.events).toHaveLength(2);
  });

  it('filters and searches the list', async () => {
    await jobs.create({ title: 'Frontend Engineer', company: 'Acme', workplaceType: 'remote' });
    await jobs.create({ title: 'Designer', company: 'Globex', status: 'applied' });
    await jobs.create({ title: 'Old role', company: 'Initech', archived: true });

    expect((await jobs.list({})).map((job) => job.company).sort()).toEqual(['Acme', 'Globex']);
    expect((await jobs.list({ q: 'front' })).map((job) => job.title)).toEqual([
      'Frontend Engineer',
    ]);
    expect((await jobs.list({ status: ['applied'] })).map((job) => job.company)).toEqual([
      'Globex',
    ]);
    expect((await jobs.list({ workplaceType: ['remote'] })).map((job) => job.company)).toEqual([
      'Acme',
    ]);
    expect((await jobs.list({ archived: true })).map((job) => job.company)).toEqual(['Initech']);
    expect(await jobs.list({ sort: 'company', order: 'desc' })).toMatchObject([
      { company: 'Globex' },
      { company: 'Acme' },
    ]);
  });

  it('manages timeline events and deletes them with the job', async () => {
    const { id } = await jobs.create({ title: 'Engineer', company: 'Acme' });
    const interview = await jobs.addEvent(id, {
      type: 'interview',
      title: 'Phone screen',
      occurredAt: '2026-10-01T15:00:00.000Z',
    });

    const edited = await jobs.updateEvent(id, interview.id, { body: 'With the hiring manager' });
    expect(edited.body).toBe('With the hiring manager');

    await jobs.remove(id);
    await expect(jobs.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
    const { rows } = await client.execute('SELECT COUNT(*) AS count FROM job_events');
    expect(rows[0].count).toBe(0);
  });
});
