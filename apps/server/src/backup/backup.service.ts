import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobs, type Job } from '../database/schema.js';
import { BACKUP_VERSION, type BackupDto } from './backup.dto.js';
import { toCsv } from './csv.js';

const CSV_COLUMNS: (keyof Job)[] = [
  'id',
  'title',
  'company',
  'status',
  'location',
  'workplaceType',
  'employmentType',
  'interest',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'salaryPeriod',
  'source',
  'url',
  'contactName',
  'contactEmail',
  'tags',
  'postedOn',
  'appliedOn',
  'deadlineOn',
  'followUpOn',
  'archived',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class BackupService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async exportJson(userId: number) {
    const [allJobs, allEvents] = await Promise.all([
      this.db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(asc(jobs.id)),
      this.db
        .select({ event: jobEvents })
        .from(jobEvents)
        .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
        .where(eq(jobs.userId, userId))
        .orderBy(asc(jobEvents.occurredAt))
        .then((rows) => rows.map((row) => row.event)),
    ]);

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      jobs: allJobs.map(({ id, userId, updatedAt, ...job }) => ({
        ...job,
        events: allEvents
          .filter((event) => event.jobId === id)
          .map(({ id: _id, jobId: _jobId, createdAt: _createdAt, ...event }) => event),
      })),
    };
  }

  async exportCsv(userId: number): Promise<string> {
    const allJobs = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(asc(jobs.id));
    return toCsv(allJobs, CSV_COLUMNS);
  }

  /** Adds every job in the backup to the user's jobs. Existing jobs are left untouched. */
  async import(userId: number, backup: BackupDto): Promise<{ imported: number }> {
    await this.db.transaction(async (tx) => {
      for (const { events = [], createdAt, ...job } of backup.jobs) {
        const [inserted] = await tx
          .insert(jobs)
          .values({ ...job, userId, ...(createdAt && { createdAt: new Date(createdAt) }) })
          .returning({ id: jobs.id });
        if (events.length === 0) continue;
        const rows = events.map((event) => ({
          ...event,
          jobId: inserted.id,
          occurredAt: new Date(event.occurredAt),
        }));
        await tx.insert(jobEvents).values(rows);
      }
    });
    return { imported: backup.jobs.length };
  }
}
