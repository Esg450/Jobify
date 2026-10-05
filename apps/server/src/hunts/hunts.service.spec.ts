import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { today } from '../common/dates.js';
import { jobs } from '../database/schema.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from './hunts.service.js';

describe('HuntsService', () => {
  let database: TestDatabase;
  let hunts: HuntsService;
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    hunts = new HuntsService(database.db);
    alice = await database.createUser('alice');
    bob = await database.createUser('bob');
  });

  afterEach(() => database.client.close());

  it('finishes the active hunt when a new one starts', async () => {
    const first = await hunts.create(alice, { name: 'First', startedOn: '2024-01-10' });
    expect(first).toMatchObject({ name: 'First', startedOn: '2024-01-10', endedOn: null });

    const second = await hunts.create(alice, { name: ' Second ' });
    expect(second).toMatchObject({ name: 'Second', startedOn: today(), endedOn: null });

    // The active hunt comes first.
    expect(await hunts.list(alice)).toMatchObject([
      { id: second.id, endedOn: null, jobCount: 0 },
      { id: first.id, endedOn: today() },
    ]);
    expect((await hunts.current(alice))?.id).toBe(second.id);
  });

  it('falls back to the most recent hunt when none is active', async () => {
    const old = await hunts.create(alice, { name: 'Old', startedOn: '2022-03-01' });
    const recent = await hunts.create(alice, { name: 'Recent', startedOn: '2025-03-01' });
    await hunts.update(alice, old.id, { endedOn: '2022-06-01' });
    await hunts.update(alice, recent.id, { endedOn: '2025-06-01' });

    expect((await hunts.current(alice))?.id).toBe(recent.id);
    expect(await hunts.current(bob)).toBeUndefined();
  });

  it('puts new jobs in the active hunt, starting one when there is none', async () => {
    const started = await hunts.forNewJob(alice);
    expect(await hunts.list(alice)).toMatchObject([
      { id: started, name: `Job hunt ${today().slice(0, 4)}`, startedOn: today(), endedOn: null },
    ]);
    expect(await hunts.forNewJob(alice)).toBe(started);

    await hunts.update(alice, started, { endedOn: today() });
    const next = await hunts.forNewJob(alice);
    expect(next).not.toBe(started);
    // A finished hunt still takes jobs when asked for by id.
    expect(await hunts.forNewJob(alice, started)).toBe(started);
  });

  it('finishes, reopens and renames hunts', async () => {
    const first = await hunts.create(alice, { name: 'First', startedOn: '2024-01-10' });
    await expect(hunts.update(alice, first.id, { endedOn: '2024-01-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const finished = await hunts.update(alice, first.id, {
      name: 'Renamed',
      endedOn: '2024-05-01',
    });
    expect(finished).toMatchObject({ name: 'Renamed', endedOn: '2024-05-01' });
    await expect(hunts.update(alice, first.id, { endedOn: null })).resolves.toMatchObject({
      endedOn: null,
    });

    // Only one hunt can be active at a time.
    await hunts.create(alice, { name: 'Second' });
    await expect(hunts.update(alice, first.id, { endedOn: null })).rejects.toBeInstanceOf(
      ConflictException,
    );
    // Renaming a finished hunt does not count as reopening it.
    await expect(hunts.update(alice, first.id, { name: 'Again' })).resolves.toMatchObject({
      name: 'Again',
      endedOn: today(),
    });
  });

  it("keeps each user's hunts private", async () => {
    const hunt = await hunts.create(alice, { name: 'Private' });
    expect(await hunts.list(bob)).toEqual([]);
    await expect(hunts.findOne(bob, hunt.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(hunts.update(bob, hunt.id, { name: 'Mine' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(hunts.remove(bob, hunt.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(hunts.forNewJob(bob, hunt.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a hunt together with its jobs', async () => {
    const doomed = await hunts.create(alice, { name: 'Doomed' });
    await database.db
      .insert(jobs)
      .values({ userId: alice, huntId: doomed.id, title: 'Gone', company: 'Acme' });
    const kept = await hunts.create(alice, { name: 'Kept' });
    await database.db
      .insert(jobs)
      .values({ userId: alice, huntId: kept.id, title: 'Stays', company: 'Globex' });

    await hunts.remove(alice, doomed.id);
    expect((await database.db.select().from(jobs)).map((job) => job.title)).toEqual(['Stays']);
  });

  describe('adoptOrphanedJobs (upgrading from a version without hunts)', () => {
    const legacyJob = (userId: number | null, company: string, createdAt: string) =>
      database.db
        .insert(jobs)
        .values({ userId, title: 'Engineer', company, createdAt: new Date(createdAt) });

    it('gives each user one hunt that starts with their earliest job', async () => {
      await legacyJob(alice, 'Acme', '2025-03-10T09:00:00Z');
      await legacyJob(alice, 'Globex', '2025-02-01T09:00:00Z');
      // Applied before it was added to Jobify.
      await database.db
        .update(jobs)
        .set({ appliedOn: '2025-01-15' })
        .where(eq(jobs.company, 'Acme'));
      await legacyJob(bob, 'Bistro', '2026-05-05T09:00:00Z');
      const before = await database.db.select().from(jobs);

      await hunts.onApplicationBootstrap();

      const [alicesHunt] = await hunts.list(alice);
      expect(alicesHunt).toMatchObject({
        name: 'Job hunt 2025',
        startedOn: '2025-01-15',
        endedOn: null,
        jobCount: 2,
      });
      expect(await hunts.list(bob)).toMatchObject([
        { name: 'Job hunt 2026', startedOn: '2026-05-05', jobCount: 1 },
      ]);

      // Nothing else about the jobs changed, including when they were last updated.
      const after = await database.db.select().from(jobs);
      expect(after.map(({ huntId: _, ...job }) => job)).toEqual(
        before.map(({ huntId: _, ...job }) => job),
      );
      expect(after.every((job) => job.huntId !== null)).toBe(true);

      // Running it again changes nothing.
      await hunts.onApplicationBootstrap();
      expect(await hunts.list(alice)).toHaveLength(1);
    });

    it('adds stray jobs to an existing hunt and leaves ownerless jobs for setup', async () => {
      const existing = await hunts.create(alice, { name: 'Existing' });
      await legacyJob(alice, 'Acme', '2025-03-10T09:00:00Z');
      await legacyJob(null, 'Pre-accounts', '2024-03-10T09:00:00Z');

      await hunts.adoptOrphanedJobs();

      expect(await hunts.list(alice)).toMatchObject([{ id: existing.id, jobCount: 1 }]);
      const [ownerless] = await database.db
        .select()
        .from(jobs)
        .where(eq(jobs.company, 'Pre-accounts'));
      expect(ownerless).toMatchObject({ userId: null, huntId: null });
    });
  });
});
