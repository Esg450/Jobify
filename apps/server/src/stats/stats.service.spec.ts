import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { StatsService } from './stats.service.js';

describe('StatsService.weeklyApplications', () => {
  // Wednesday
  const now = new Date('2026-09-30T12:00:00Z');

  it('returns twelve Monday-based weeks ending with the current one', () => {
    const weeks = StatsService.weeklyApplications([], now);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)?.week).toBe('2026-09-28');
    expect(weeks[0].week).toBe('2026-07-13');
  });

  it('counts applications into their week and ignores older ones', () => {
    const weeks = StatsService.weeklyApplications(
      ['2026-09-28', '2026-10-04', '2026-09-27', '2025-01-01'],
      now,
    );
    expect(weeks.at(-1)?.count).toBe(2);
    expect(weeks.at(-2)?.count).toBe(1);
    expect(weeks.reduce((total, week) => total + week.count, 0)).toBe(3);
  });
});

describe('StatsService', () => {
  let database: TestDatabase;
  let hunts: HuntsService;
  let jobs: JobsService;
  let stats: StatsService;
  let alice: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    hunts = new HuntsService(database.db);
    jobs = new JobsService(database.db, hunts);
    stats = new StatsService(database.db, hunts);
    alice = await database.createUser('alice');
  });

  afterEach(() => database.client.close());

  it('is empty for someone who has not added a job yet', async () => {
    await expect(stats.overview(alice)).resolves.toMatchObject({
      total: 0,
      applied: 0,
      responseRate: null,
      upcoming: [],
      recentActivity: [],
    });
    await expect(stats.huntSummaries(alice)).resolves.toEqual([]);
  });

  it('covers one hunt at a time and summarizes each hunt', async () => {
    // First hunt: three applications, one of which was interviewed and accepted.
    const accepted = await jobs.create(alice, {
      title: 'Engineer',
      company: 'Acme',
      status: 'applied',
      appliedOn: '2024-02-05',
    });
    await jobs.update(alice, accepted.id, { status: 'interviewing' });
    await jobs.addEvent(alice, accepted.id, {
      type: 'interview',
      title: 'Onsite',
      occurredAt: '2024-02-20T10:00:00.000Z',
    });
    await jobs.update(alice, accepted.id, { status: 'offer' });
    await jobs.update(alice, accepted.id, { status: 'accepted' });
    const rejected = await jobs.create(alice, {
      title: 'Designer',
      company: 'Globex',
      status: 'applied',
      appliedOn: '2024-02-06',
      archived: true,
    });
    await jobs.update(alice, rejected.id, { status: 'rejected' });
    await jobs.create(alice, { title: 'Saved only', company: 'Initech' });
    const [first] = await hunts.list(alice);
    await hunts.update(alice, first.id, { startedOn: '2024-01-01', endedOn: '2024-03-01' });

    // Second hunt: one application so far.
    const second = await hunts.create(alice, { name: 'Round two' });
    await jobs.create(alice, { title: 'Manager', company: 'Hooli', status: 'applied' });

    const current = await stats.overview(alice);
    expect(current).toMatchObject({ total: 1, applied: 1, responseRate: 0 });
    expect(current.byStatus).toMatchObject({ applied: 1, accepted: 0 });
    expect(current.recentActivity.map((event) => event.job.company)).toEqual(['Hooli']);

    const earlier = await stats.overview(alice, first.id);
    // The archived job is left out of the dashboard.
    expect(earlier).toMatchObject({ total: 2, applied: 1, responseRate: 1 });
    expect(earlier.byStatus).toMatchObject({ accepted: 1, saved: 1 });
    // The weekly chart of a finished hunt ends when the hunt did.
    expect(earlier.weekly.at(-1)?.week).toBe('2024-02-26');
    expect(earlier.weekly.reduce((total, week) => total + week.count, 0)).toBe(1);

    expect(await stats.huntSummaries(alice)).toEqual([
      {
        huntId: second.id,
        jobs: 1,
        applied: 1,
        responseRate: 0,
        interviews: 0,
        offers: 0,
        accepted: null,
      },
      {
        huntId: first.id,
        jobs: 3,
        applied: 2,
        responseRate: 0.5,
        interviews: 1,
        offers: 1,
        accepted: { id: accepted.id, title: 'Engineer', company: 'Acme' },
      },
    ]);
  });
});
