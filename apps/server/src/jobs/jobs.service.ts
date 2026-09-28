import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, inArray, like, or, type SQL } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobs, type Job, type JobEvent } from '../database/schema.js';
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

@Injectable()
export class JobsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(query: QueryJobsDto): Promise<JobSummary[]> {
    const filters: SQL[] = [eq(jobs.archived, query.archived ?? false)];
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

  async findOne(id: number): Promise<JobWithEvents> {
    const job = await this.db.query.jobs.findFirst({ where: eq(jobs.id, id) });
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    const events = await this.db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, id))
      .orderBy(desc(jobEvents.occurredAt), desc(jobEvents.id));

    return { ...job, events };
  }

  async create(dto: CreateJobDto): Promise<JobWithEvents> {
    const status = dto.status ?? 'saved';
    const appliedOn = dto.appliedOn ?? (status === 'saved' ? null : today());

    const id = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .insert(jobs)
        .values({ ...dto, status, appliedOn })
        .returning({ id: jobs.id });
      await tx
        .insert(jobEvents)
        .values({ jobId: job.id, type: 'created', toStatus: status, occurredAt: new Date() });
      return job.id;
    });

    return this.findOne(id);
  }

  async update(id: number, dto: UpdateJobDto): Promise<JobWithEvents> {
    const existing = await this.findOne(id);
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const changes: UpdateJobDto = { ...dto };
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

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.db.delete(jobs).where(eq(jobs.id, id)).returning({ id: jobs.id });
    if (deleted.length === 0) throw new NotFoundException(`Job ${id} not found`);
  }

  async addEvent(jobId: number, dto: CreateJobEventDto): Promise<JobEvent> {
    await this.assertExists(jobId);
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

  async updateEvent(jobId: number, eventId: number, dto: UpdateJobEventDto): Promise<JobEvent> {
    const { occurredAt, ...rest } = dto;
    const [event] = await this.db
      .update(jobEvents)
      .set({ ...rest, ...(occurredAt && { occurredAt: new Date(occurredAt) }) })
      .where(and(eq(jobEvents.id, eventId), eq(jobEvents.jobId, jobId)))
      .returning();
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);
    return event;
  }

  async removeEvent(jobId: number, eventId: number): Promise<void> {
    const deleted = await this.db
      .delete(jobEvents)
      .where(and(eq(jobEvents.id, eventId), eq(jobEvents.jobId, jobId)))
      .returning({ id: jobEvents.id });
    if (deleted.length === 0) throw new NotFoundException(`Event ${eventId} not found`);
  }

  private async assertExists(id: number): Promise<void> {
    const job = await this.db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      columns: { id: true },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
  }

  /** Bumps updatedAt so recently touched jobs sort first. */
  private async touch(id: number): Promise<void> {
    await this.db.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, id));
  }
}
