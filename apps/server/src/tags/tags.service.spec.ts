import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { defaultTagColor } from './tag.constants.js';
import { TagsService } from './tags.service.js';

describe('TagsService', () => {
  let database: TestDatabase;
  let jobs: JobsService;
  let tags: TagsService;
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    jobs = new JobsService(database.db, new HuntsService(database.db));
    tags = new TagsService(database.db);
    alice = await database.createUser('alice');
    bob = await database.createUser('bob');
  });

  afterEach(() => database.client.close());

  it('lists tags used on jobs and saved tags, with colors and counts', async () => {
    await jobs.create(alice, { title: 'A', company: 'One', tags: ['remote', 'dream'] });
    await jobs.create(alice, { title: 'B', company: 'Two', tags: ['remote'] });
    await jobs.create(bob, { title: 'C', company: 'Three', tags: ['bob only'] });
    await tags.save(alice, { name: 'later', color: 'pink' });
    await tags.save(alice, { name: 'dream', color: 'violet' });

    expect(await tags.list(alice)).toEqual([
      { name: 'dream', color: 'violet', count: 1 },
      { name: 'later', color: 'pink', count: 0 },
      { name: 'remote', color: defaultTagColor('remote'), count: 2 },
    ]);
  });

  it('saving an existing tag changes its color instead of adding another', async () => {
    await tags.save(alice, { name: 'later', color: 'pink' });
    await tags.save(alice, { name: 'later', color: 'teal' });
    expect(await tags.list(alice)).toEqual([{ name: 'later', color: 'teal', count: 0 }]);
  });
});
