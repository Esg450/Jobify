import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobHunts, jobs, type Job, type JobEvent } from '../database/schema.js';
import { HuntsService } from '../hunts/hunts.service.js';
import type { JobStatus } from './job.constants.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { CreateJobEventDto, UpdateJobEventDto } from './dto/job-event.dto.js';
import type { QueryJobsDto } from './dto/query-jobs.dto.js';
import type { UpdateJobDto } from './dto/update-job.dto.js';
import {
  isDuplicate,
  normalizeJobUrl,
  normalizeText,
  type DuplicateCandidate,
} from './duplicates.js';

/** Large text columns are left out of list responses to keep them small. */
const { description, notes, aiSummary, coverLetter, interviewPrep, ...summaryColumns } =
  getTableColumns(jobs);

export type JobSummary = Omit<
  Job,
  'description' | 'notes' | 'aiSummary' | 'coverLetter' | 'interviewPrep'
>;
export type JobWithEvents = Job & { events: JobEvent[] };

/** An existing job that a new one appears to repeat, with enough to show and link to it. */
export interface DuplicateJob {
  id: number;
  title: string;
  company: string;
  url: string | null;
  status: JobStatus;
  archived: boolean;
  hunt: { id: number; name: string } | null;
}

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
    if (query.tags?.length) {
      filters.push(
        sql`exists (select 1 from json_each(${jobs.tags}) where value in ${query.tags})`,
      );
    }
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

  /**
   * The user's existing jobs (in any hunt, archived or not) that look like the same posting as
   * `candidate`: same URL ignoring tracking parameters, or same title and company.
   */
  async findDuplicates(userId: number, candidate: DuplicateCandidate): Promise<DuplicateJob[]> {
    const url = normalizeJobUrl(candidate.url);
    const title = normalizeText(candidate.title);
    const company = normalizeText(candidate.company);

    // A cheap SQL pre-filter; `isDuplicate` makes the final call with full normalization.
    const matches: SQL[] = [];
    if (title && company) matches.push(eq(sql`lower(trim(${jobs.company}))`, company));
    // Stored URLs keep their original query string, so only the page part can be matched here.
    if (url) matches.push(like(jobs.url, `${url.split('?')[0]}%`));
    if (matches.length === 0) return [];

    const rows = await this.db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        url: jobs.url,
        status: jobs.status,
        archived: jobs.archived,
        huntId: jobHunts.id,
        huntName: jobHunts.name,
      })
      .from(jobs)
      .leftJoin(jobHunts, eq(jobHunts.id, jobs.huntId))
      .where(and(eq(jobs.userId, userId), or(...matches)))
      .orderBy(desc(jobs.updatedAt), desc(jobs.id));

    return rows
      .filter((row) => isDuplicate(candidate, row))
      .map(({ huntId, huntName, ...row }) => ({
        ...row,
        hunt: huntId != null && huntName != null ? { id: huntId, name: huntName } : null,
      }));
  }

  async create(userId: number, dto: CreateJobDto): Promise<JobWithEvents> {
    const { allowDuplicate, ...values } = dto;
    if (!allowDuplicate) {
      const duplicates = await this.findDuplicates(userId, values);
      if (duplicates.length > 0) {
        throw new ConflictException({
          message: `You already have this job: ${duplicates[0].title} at ${duplicates[0].company}`,
          duplicates,
        });
      }
    }

    const status = values.status ?? 'saved';
    const appliedOn = values.appliedOn ?? (status === 'saved' ? null : today());
    const huntId = await this.hunts.forNewJob(userId, values.huntId ?? undefined);

    const id = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .insert(jobs)
        .values({ ...values, userId, huntId, status, appliedOn })
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
