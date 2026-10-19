import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobs, tags } from '../database/schema.js';
import { defaultTagColor, type TagColor } from './tag.constants.js';
import type { SaveTagDto } from './tag.dto.js';

export interface TagSummary {
  name: string;
  color: TagColor;
  /** How many of the user's jobs (in any hunt) carry the tag. */
  count: number;
}

/**
 * A user's tags. Jobs store tag names in `jobs.tags`; the `tags` table only holds tags that were
 * created or recolored explicitly. Listing merges both, so tags typed before this existed still
 * show up with a default color.
 */
@Injectable()
export class TagsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(userId: number): Promise<TagSummary[]> {
    const [used, saved] = await Promise.all([
      this.db
        .select({ name: sql<string>`tag.value`, count: sql<number>`count(distinct "jobs"."id")` })
        .from(sql`${jobs}, json_each(${jobs.tags}) as tag`)
        .where(eq(jobs.userId, userId))
        .groupBy(sql`tag.value`),
      this.db
        .select({ name: tags.name, color: tags.color })
        .from(tags)
        .where(eq(tags.userId, userId)),
    ]);

    const byName = new Map<string, TagSummary>();
    for (const { name, color } of saved) byName.set(name, { name, color, count: 0 });
    for (const { name, count } of used) {
      byName.set(name, { name, color: byName.get(name)?.color ?? defaultTagColor(name), count });
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Creates a tag, or changes the color of one the user already has. */
  async save(userId: number, dto: SaveTagDto): Promise<TagSummary> {
    const name = dto.name.trim();
    await this.db
      .insert(tags)
      .values({ userId, name, color: dto.color })
      .onConflictDoUpdate({ target: [tags.userId, tags.name], set: { color: dto.color } });
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(distinct "jobs"."id")` })
      .from(sql`${jobs}, json_each(${jobs.tags}) as tag`)
      .where(and(eq(jobs.userId, userId), sql`tag.value = ${name}`));
    return { name, color: dto.color, count };
  }
}
