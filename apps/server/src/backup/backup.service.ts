import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database, type Executor } from '../database/database.module.js';
import { jobEvents, jobHunts, jobs, type Job } from '../database/schema.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { BACKUP_VERSION, type BackupDto, type BackupHuntDto } from './backup.dto.js';
import { toCsv } from './csv.js';

const CSV_COLUMNS: (keyof Job | 'hunt')[] = [
  'id',
  'hunt',
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
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly hunts: HuntsService,
  ) {}

  async exportJson(userId: number) {
    const [allHunts, allJobs, allEvents] = await Promise.all([
      this.db.select().from(jobHunts).where(eq(jobHunts.userId, userId)).orderBy(asc(jobHunts.id)),
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
      hunts: allHunts.map(({ name, startedOn, endedOn }) => ({ name, startedOn, endedOn })),
      jobs: allJobs.map(({ id, userId, huntId, updatedAt, ...job }) => ({
        ...job,
        // The position of the job's hunt in `hunts`.
        hunt: allHunts.findIndex((hunt) => hunt.id === huntId),
        events: allEvents
          .filter((event) => event.jobId === id)
          .map(({ id: _id, jobId: _jobId, createdAt: _createdAt, ...event }) => event),
      })),
    };
  }

  async exportCsv(userId: number): Promise<string> {
    const rows = await this.db
      .select({ job: jobs, hunt: jobHunts.name })
      .from(jobs)
      .leftJoin(jobHunts, eq(jobHunts.id, jobs.huntId))
      .where(eq(jobs.userId, userId))
      .orderBy(asc(jobs.id));
    return toCsv(
      rows.map(({ job, hunt }) => ({ ...job, hunt })),
      CSV_COLUMNS,
    );
  }

  /**
   * Adds every job in the backup to the user's jobs. Existing jobs are left untouched. The
   * backup's finished hunts are recreated; its active hunt, and jobs without a hunt (version 1
   * backups), go into the user's active hunt.
   */
  async import(userId: number, backup: BackupDto): Promise<{ imported: number }> {
    await this.db.transaction(async (tx) => {
      const active = () => this.hunts.forNewJob(userId, undefined, tx);
      const huntIds = new Map<number, number>();
      const huntIdFor = async (index: number | undefined): Promise<number> => {
        const hunt = index === undefined ? undefined : backup.hunts?.[index];
        if (index === undefined || !hunt) return active();
        if (!huntIds.has(index)) huntIds.set(index, await this.importHunt(tx, userId, hunt));
        return huntIds.get(index)!;
      };

      for (const { events = [], createdAt, hunt, ...job } of backup.jobs) {
        const huntId = await huntIdFor(hunt);
        const [inserted] = await tx
          .insert(jobs)
          .values({ ...job, userId, huntId, ...(createdAt && { createdAt: new Date(createdAt) }) })
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

  private async importHunt(tx: Executor, userId: number, hunt: BackupHuntDto): Promise<number> {
    if (!hunt.endedOn) return this.hunts.forNewJob(userId, undefined, tx);
    const [inserted] = await tx
      .insert(jobHunts)
      .values({ userId, name: hunt.name, startedOn: hunt.startedOn, endedOn: hunt.endedOn })
      .returning({ id: jobHunts.id });
    return inserted.id;
  }
}
