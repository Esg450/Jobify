import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { BackupDto } from './backup.dto.js';
import { BackupService } from './backup.service.js';

describe('BackupService', () => {
  let database: TestDatabase;
  let hunts: HuntsService;
  let jobs: JobsService;
  let backup: BackupService;
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    hunts = new HuntsService(database.db);
    jobs = new JobsService(database.db, hunts);
    backup = new BackupService(database.db, hunts);
    alice = await database.createUser('alice');
    bob = await database.createUser('bob');
  });

  afterEach(() => database.client.close());

  /** Hunt names with the companies in each, e.g. "Old (finished): Acme". */
  const overview = async (userId: number) =>
    Promise.all(
      (await hunts.list(userId)).map(async (hunt) => {
        const companies = (await jobs.list(userId, { huntId: hunt.id })).map((job) => job.company);
        return `${hunt.name}${hunt.endedOn ? ' (finished)' : ''}: ${companies.sort().join(', ')}`;
      }),
    );

  it('imports backups made before job hunts existed into the active hunt', async () => {
    const legacy = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      jobs: [
        {
          title: 'Engineer',
          company: 'Acme',
          status: 'applied',
          createdAt: '2025-12-01T00:00:00.000Z',
          events: [
            { type: 'created', toStatus: 'applied', occurredAt: '2025-12-01T00:00:00.000Z' },
          ],
        },
        { title: 'Designer', company: 'Globex' },
      ],
    } as BackupDto;

    // Without a hunt, the import starts one.
    await expect(backup.import(alice, legacy)).resolves.toEqual({ imported: 2 });
    expect(await overview(alice)).toEqual([
      expect.stringMatching(/^Job hunt \d{4}: Acme, Globex$/),
    ]);

    // With an active hunt, the jobs join it.
    await hunts.create(bob, { name: 'Searching' });
    await backup.import(bob, legacy);
    expect(await overview(bob)).toEqual(['Searching: Acme, Globex']);
    expect((await jobs.timeline(bob, false)).find((job) => job.company === 'Acme')?.events).toEqual(
      [expect.objectContaining({ type: 'created', toStatus: 'applied' })],
    );
  });

  it('round-trips hunts: finished ones are recreated, the active one is merged', async () => {
    await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    const [old] = await hunts.list(alice);
    await hunts.update(alice, old.id, {
      name: 'Old',
      startedOn: '2024-01-01',
      endedOn: '2024-03-01',
    });
    await hunts.create(alice, { name: 'Now' });
    await jobs.create(alice, { title: 'Designer', company: 'Globex' });

    const exported = await backup.exportJson(alice);
    expect(exported.version).toBe(2);
    expect(exported.hunts).toEqual([
      { name: 'Old', startedOn: '2024-01-01', endedOn: '2024-03-01' },
      expect.objectContaining({ name: 'Now', endedOn: null }),
    ]);
    expect(exported.jobs.map((job) => [job.company, job.hunt])).toEqual([
      ['Acme', 0],
      ['Globex', 1],
    ]);
    expect(exported.jobs[0]).not.toHaveProperty('huntId');

    await hunts.create(bob, { name: "Bob's search" });
    await backup.import(bob, JSON.parse(JSON.stringify(exported)) as BackupDto);
    expect(await overview(bob)).toEqual(["Bob's search: Globex", 'Old (finished): Acme']);
  });

  it('names the hunt in the CSV export', async () => {
    await hunts.create(alice, { name: 'Spring search' });
    await jobs.create(alice, { title: 'Engineer', company: 'Acme' });
    const [header, row] = (await backup.exportCsv(alice)).split('\r\n');
    expect(header.split(',').slice(0, 3)).toEqual(['id', 'hunt', 'title']);
    expect(row.split(',').slice(1, 3)).toEqual(['Spring search', 'Engineer']);
  });
});
