import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, inArray, like, or, type SQL } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobs, type Job, type JobEvent } from '../database/schema.js';
import { HuntsService } from '../hunts/hunts.service.js';
import type { JobStatus } from './job.constants.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { CreateJobEventDto, UpdateJobEventDto } from './dto/job-event.dto.js';
import type { QueryJobsDto } from './dto/query-jobs.dto.js';
import type { UpdateJobDto } from './dto/update-job.dto.js';

/** Large text columns are left out of list responses to keep them small. */
const { description, notes, aiSummary, coverLetter, interviewPrep, ...summaryColumns } =
  getTableColumns(jobs);

export type JobSummary = Omit<
  Job,
  'description' | 'notes' | 'aiSummary' | 'coverLetter' | 'interviewPrep'
>;
export type JobWithEvents = Job & { events: JobEvent[] };

/** A job with the status history and interviews needed to draw it on a timeline. */
export interface TimelineJob {
  id: number;
  title: string;
  company: string;
  status: JobStatus;
  appliedOn: string | null;
  createdAt: Date;
  events: Pick<JobEvent, 'type' | 'fromStatus' | 'toStatus' | 'title' | 'occurredAt'>[];
}

/**
 * Jobs belong to a single user. Every method takes the owner's id and behaves as if other
 * users' jobs do not exist. Lists and charts cover one job hunt: the requested one, or the
 * user's current hunt.
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly hunts: HuntsService,
  ) {}

  async list(userId: number, query: QueryJobsDto): Promise<JobSummary[]> {
    const hunt = await this.hunts.resolve(userId, query.huntId);
    if (!hunt) return [];

    const filters: SQL[] = [
      eq(jobs.userId, userId),
      eq(jobs.huntId, hunt.id),
      eq(jobs.archived, query.archived ?? false),
    ];
    if (query.status?.length) filters.push(inArray(jobs.status, query.status));
    if (query.workplaceType?.length) filters.push(inArray(jobs.workplaceType, query.workplaceType));
    if (query.q) {
      const pattern = `%${query.q}%`;
      filters.push(
        or(like(jobs.title, pattern), like(jobs.company, pattern), like(jobs.location, pattern))!,
      );
    }

    const direction = query.order === 'asc' ? asc : desc;
    const sortColumn = jobs[query.sort ?? 'updatedAt'];

    return this.db
      .select(summaryColumns)
      .from(jobs)
      .where(and(...filters))
      .orderBy(direction(sortColumn), desc(jobs.id));
  }

  /** Every job in a hunt (optionally archived ones too) with its status changes and interviews. */
  async timeline(
    userId: number,
    includeArchived: boolean,
    huntId?: number,
  ): Promise<TimelineJob[]> {
    const hunt = await this.hunts.resolve(userId, huntId);
    if (!hunt) return [];

    const rows = await this.db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        status: jobs.status,
        appliedOn: jobs.appliedOn,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.userId, userId),
          eq(jobs.huntId, hunt.id),
          includeArchived ? undefined : eq(jobs.archived, false),
        ),
      )
      .orderBy(asc(jobs.createdAt));
    if (rows.length === 0) return [];

    const events = await this.db
      .select({
        jobId: jobEvents.jobId,
        type: jobEvents.type,
        fromStatus: jobEvents.fromStatus,
        toStatus: jobEvents.toStatus,
        title: jobEvents.title,
        occurredAt: jobEvents.occurredAt,
      })
      .from(jobEvents)
      .where(
        and(
          inArray(
            jobEvents.jobId,
            rows.map((row) => row.id),
          ),
          inArray(jobEvents.type, ['created', 'status_change', 'interview']),
        ),
      )
      .orderBy(asc(jobEvents.occurredAt), asc(jobEvents.id));

    return rows.map((row) => ({
      ...row,
      events: events
        .filter((event) => event.jobId === row.id)
        .map(({ jobId: _, ...event }) => event),
    }));
  }

  async findOne(userId: number, id: number): Promise<JobWithEvents> {
    const job = await this.db.query.jobs.findFirst({ where: JobsService.owned(userId, id) });
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    const events = await this.db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, id))
      .orderBy(desc(jobEvents.occurredAt), desc(jobEvents.id));

    return { ...job, events };
  }

  async create(userId: number, dto: CreateJobDto): Promise<JobWithEvents> {
    const status = dto.status ?? 'saved';
    const appliedOn = dto.appliedOn ?? (status === 'saved' ? null : today());
    const huntId = await this.hunts.forNewJob(userId, dto.huntId ?? undefined);

    const id = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .insert(jobs)
        .values({ ...dto, userId, huntId, status, appliedOn })
        .returning({ id: jobs.id });
      await tx
        .insert(jobEvents)
        .values({ jobId: job.id, type: 'created', toStatus: status, occurredAt: new Date() });
      return job.id;
    });

    return this.findOne(userId, id);
  }

  async update(userId: number, id: number, dto: UpdateJobDto): Promise<JobWithEvents> {
    const existing = await this.findOne(userId, id);
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const changes: UpdateJobDto = { ...dto };
    // A job can move to another of the user's hunts, but never out of hunts altogether.
    if (dto.huntId == null) delete changes.huntId;
    else await this.hunts.findOne(userId, dto.huntId);
    if (statusChanged && existing.status === 'saved' && !existing.appliedOn && !dto.appliedOn) {
      changes.appliedOn = today();
    }

    await this.db.transaction(async (tx) => {
      await tx.update(jobs).set(changes).where(eq(jobs.id, id));
      if (statusChanged) {
        await tx.insert(jobEvents).values({
          jobId: id,
          type: 'status_change',
          fromStatus: existing.status,
          toStatus: dto.status,
          occurredAt: new Date(),
        });
      }
    });

    return this.findOne(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const deleted = await this.db
      .delete(jobs)
      .where(JobsService.owned(userId, id))
      .returning({ id: jobs.id });
    if (deleted.length === 0) throw new NotFoundException(`Job ${id} not found`);
  }

  async addEvent(userId: number, jobId: number, dto: CreateJobEventDto): Promise<JobEvent> {
    await this.assertOwned(userId, jobId);
    const [event] = await this.db
      .insert(jobEvents)
      .values({
        jobId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      })
      .returning();
    await this.touch(jobId);
    return event;
  }

  async updateEvent(
    userId: number,
    jobId: number,
    eventId: number,
    dto: UpdateJobEventDto,
  ): Promise<JobEvent> {
    await this.assertOwned(userId, jobId);
    const { occurredAt, ...rest } = dto;
    const [event] = await this.db
      .update(jobEvents)
      .set({ ...rest, ...(occurredAt && { occurredAt: new Date(occurredAt) }) })
      .where(and(eq(jobEvents.id, eventId), eq(jobEvents.jobId, jobId)))
      .returning();
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);
    return event;
  }

  async removeEvent(userId: number, jobId: number, eventId: number): Promise<void> {
    await this.assertOwned(userId, jobId);
    const deleted = await this.db
      .delete(jobEvents)
      .where(and(eq(jobEvents.id, eventId), eq(jobEvents.jobId, jobId)))
      .returning({ id: jobEvents.id });
    if (deleted.length === 0) throw new NotFoundException(`Event ${eventId} not found`);
  }

  private static owned(userId: number, id: number): SQL {
    return and(eq(jobs.id, id), eq(jobs.userId, userId))!;
  }

  private async assertOwned(userId: number, id: number): Promise<void> {
    const job = await this.db.query.jobs.findFirst({
      where: JobsService.owned(userId, id),
      columns: { id: true },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
  }

  /** Bumps updatedAt so recently touched jobs sort first. */
  private async touch(id: number): Promise<void> {
    await this.db.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, id));
  }
}
