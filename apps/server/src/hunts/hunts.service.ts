import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { and, count, desc, eq, isNotNull, isNull, min, sql } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database, type Executor } from '../database/database.module.js';
import { jobHunts, jobs, type JobHunt } from '../database/schema.js';
import type { CreateHuntDto, UpdateHuntDto } from './hunt.dto.js';

export type JobHuntWithCount = JobHunt & { jobCount: number };

/** The active hunt first, then finished ones from the most recent. */
const NEWEST_FIRST = [
  sql`${jobHunts.endedOn} is not null`,
  desc(jobHunts.startedOn),
  desc(jobHunts.id),
];

/**
 * Job hunts belong to a single user, who has at most one active (unfinished) hunt. Like
 * `JobsService`, every method takes the owner's id.
 */
@Injectable()
export class HuntsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HuntsService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Upgrades from versions without hunts: gives every existing job a hunt. */
  async onApplicationBootstrap(): Promise<void> {
    await this.adoptOrphanedJobs();
  }

  list(userId: number): Promise<JobHuntWithCount[]> {
    return this.db
      .select({ hunt: jobHunts, jobCount: count(jobs.id) })
      .from(jobHunts)
      .leftJoin(jobs, eq(jobs.huntId, jobHunts.id))
      .where(eq(jobHunts.userId, userId))
      .groupBy(jobHunts.id)
      .orderBy(...NEWEST_FIRST)
      .then((rows) => rows.map(({ hunt, jobCount }) => ({ ...hunt, jobCount })));
  }

  async findOne(userId: number, id: number, db: Executor = this.db): Promise<JobHunt> {
    const hunt = await db.query.jobHunts.findFirst({
      where: and(eq(jobHunts.id, id), eq(jobHunts.userId, userId)),
    });
    if (!hunt) throw new NotFoundException(`Job hunt ${id} not found`);
    return hunt;
  }

  /** The hunt shown by default: the active one, or the most recent if none is active. */
  async current(userId: number, db: Executor = this.db): Promise<JobHunt | undefined> {
    const [hunt] = await db
      .select()
      .from(jobHunts)
      .where(eq(jobHunts.userId, userId))
      .orderBy(...NEWEST_FIRST)
      .limit(1);
    return hunt;
  }

  /** The hunt a list or chart is about: the requested one, or the current one by default. */
  resolve(userId: number, huntId?: number): Promise<JobHunt | undefined> {
    return huntId === undefined ? this.current(userId) : this.findOne(userId, huntId);
  }

  /**
   * The hunt a new job goes into: the requested one, or the active one by default. Adding a
   * job while no hunt is active starts one, so nobody has to create a hunt before they can
   * track anything.
   */
  async forNewJob(userId: number, huntId?: number, db: Executor = this.db): Promise<number> {
    if (huntId !== undefined) return (await this.findOne(userId, huntId, db)).id;
    const current = await this.current(userId, db);
    if (current && !current.endedOn) return current.id;
    return (await HuntsService.insert(db, userId, today())).id;
  }

  /** Starts a new hunt, finishing the active one if there is one. */
  async create(userId: number, dto: CreateHuntDto): Promise<JobHunt> {
    const startedOn = dto.startedOn ?? today();
    return this.db.transaction(async (tx) => {
      const current = await this.current(userId, tx);
      if (current && !current.endedOn) {
        // Never end a hunt before it began, even if its start date is in the future.
        const endedOn = today() > current.startedOn ? today() : current.startedOn;
        await tx.update(jobHunts).set({ endedOn }).where(eq(jobHunts.id, current.id));
      }
      return HuntsService.insert(tx, userId, startedOn, dto.name.trim());
    });
  }

  async update(userId: number, id: number, dto: UpdateHuntDto): Promise<JobHunt> {
    const existing = await this.findOne(userId, id);
    const startedOn = dto.startedOn ?? existing.startedOn;
    const endedOn = dto.endedOn === undefined ? existing.endedOn : dto.endedOn;

    if (endedOn && endedOn < startedOn) {
      throw new BadRequestException('A job hunt cannot end before it starts');
    }
    if (!endedOn && existing.endedOn) {
      const current = await this.current(userId);
      if (current && !current.endedOn) {
        throw new ConflictException(`Finish "${current.name}" before reopening another job hunt`);
      }
    }

    const [hunt] = await this.db
      .update(jobHunts)
      .set({ name: dto.name?.trim() || undefined, startedOn, endedOn })
      .where(eq(jobHunts.id, id))
      .returning();
    return hunt;
  }

  /** Deletes a hunt together with its jobs (ON DELETE CASCADE). */
  async remove(userId: number, id: number): Promise<void> {
    const deleted = await this.db
      .delete(jobHunts)
      .where(and(eq(jobHunts.id, id), eq(jobHunts.userId, userId)))
      .returning({ id: jobHunts.id });
    if (deleted.length === 0) throw new NotFoundException(`Job hunt ${id} not found`);
  }

  /**
   * Moves jobs that have an owner but no hunt into the owner's current hunt, creating one that
   * starts with the earliest of those jobs if the owner has none. Such jobs exist after
   * upgrading from a version without hunts, after an older version wrote to the database, and
   * when the first admin claims pre-accounts jobs. Safe to run any number of times.
   */
  async adoptOrphanedJobs(userId?: number): Promise<void> {
    const orphaned = and(isNull(jobs.huntId), isNotNull(jobs.userId));
    const owners = await this.db
      .select({
        userId: jobs.userId,
        total: count(),
        firstApplied: min(jobs.appliedOn),
        firstCreated: sql<string>`date(min(${jobs.createdAt}) / 1000, 'unixepoch')`,
      })
      .from(jobs)
      .where(userId === undefined ? orphaned : and(orphaned, eq(jobs.userId, userId)))
      .groupBy(jobs.userId);

    for (const owner of owners) {
      const ownerId = owner.userId!;
      const hunt = await this.db.transaction(async (tx) => {
        const startedOn =
          owner.firstApplied && owner.firstApplied < owner.firstCreated
            ? owner.firstApplied
            : owner.firstCreated;
        const target =
          (await this.current(ownerId, tx)) ?? (await HuntsService.insert(tx, ownerId, startedOn));
        await tx
          .update(jobs)
          // Keep updatedAt as it is, so the list's "recently updated" order survives.
          .set({ huntId: target.id, updatedAt: sql`${jobs.updatedAt}` })
          .where(and(eq(jobs.userId, ownerId), isNull(jobs.huntId)));
        return target;
      });
      this.logger.log(`Moved ${owner.total} job(s) of user ${ownerId} into "${hunt.name}"`);
    }
  }

  private static async insert(
    db: Executor,
    userId: number,
    startedOn: string,
    name = `Job hunt ${startedOn.slice(0, 4)}`,
  ): Promise<JobHunt> {
    const [hunt] = await db.insert(jobHunts).values({ userId, name, startedOn }).returning();
    return hunt;
  }
}
