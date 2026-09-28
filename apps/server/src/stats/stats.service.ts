import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobs, type Job } from '../database/schema.js';
import { ACTIVE_STATUSES, JOB_STATUSES, type JobStatus } from '../jobs/job.constants.js';

/** Statuses that mean the employer responded positively to an application. */
const RESPONDED_STATUSES: JobStatus[] = ['screening', 'interviewing', 'offer', 'accepted'];
const WEEKS_OF_HISTORY = 12;
const UPCOMING_DAYS = 14;
const DAY_MS = 86_400_000;

type DatedJob = Pick<Job, 'id' | 'title' | 'company' | 'status' | 'followUpOn' | 'deadlineOn'>;

@Injectable()
export class StatsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async overview() {
    const allJobs = await this.db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        status: jobs.status,
        appliedOn: jobs.appliedOn,
        followUpOn: jobs.followUpOn,
        deadlineOn: jobs.deadlineOn,
      })
      .from(jobs)
      .where(eq(jobs.archived, false));

    const byStatus = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<
      JobStatus,
      number
    >;
    for (const job of allJobs) byStatus[job.status]++;

    const applied = allJobs.filter((job) => job.appliedOn);
    const respondedIds = await this.respondedJobIds();
    const responded = applied.filter(
      (job) => respondedIds.has(job.id) || RESPONDED_STATUSES.includes(job.status),
    );

    return {
      total: allJobs.length,
      active: allJobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length,
      applied: applied.length,
      responseRate: applied.length ? responded.length / applied.length : null,
      byStatus,
      weekly: StatsService.weeklyApplications(applied.map((job) => job.appliedOn!)),
      upcoming: await this.upcoming(allJobs),
      recentActivity: await this.recentActivity(),
    };
  }

  /** Jobs that reached a "responded" status at any point, even if later rejected. */
  private async respondedJobIds(): Promise<Set<number>> {
    const rows = await this.db
      .selectDistinct({ jobId: jobEvents.jobId })
      .from(jobEvents)
      .where(inArray(jobEvents.toStatus, RESPONDED_STATUSES));
    return new Set(rows.map((row) => row.jobId));
  }

  private async upcoming(allJobs: DatedJob[]) {
    const from = today();
    const until = new Date(Date.now() + UPCOMING_DAYS * DAY_MS).toISOString().slice(0, 10);
    const open = allJobs.filter((job) => ACTIVE_STATUSES.includes(job.status));

    const dated = [
      ...open
        .filter((job) => job.followUpOn && job.followUpOn <= until)
        .map((job) => ({ type: 'follow_up' as const, date: job.followUpOn!, job })),
      ...open
        .filter((job) => job.deadlineOn && job.deadlineOn >= from && job.deadlineOn <= until)
        .map((job) => ({ type: 'deadline' as const, date: job.deadlineOn!, job })),
    ];

    const interviews = await this.db
      .select({
        date: jobEvents.occurredAt,
        title: jobEvents.title,
        job: { id: jobs.id, title: jobs.title, company: jobs.company },
      })
      .from(jobEvents)
      .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
      .where(
        and(
          eq(jobEvents.type, 'interview'),
          gte(jobEvents.occurredAt, new Date(Date.now() - DAY_MS)),
        ),
      )
      .orderBy(jobEvents.occurredAt)
      .limit(10);

    return [
      ...interviews.map((interview) => ({
        type: 'interview' as const,
        date: interview.date.toISOString(),
        label: interview.title,
        job: interview.job,
      })),
      ...dated.map(({ type, date, job }) => ({
        type,
        date,
        label: null,
        job: { id: job.id, title: job.title, company: job.company },
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }

  private recentActivity() {
    return this.db
      .select({
        id: jobEvents.id,
        type: jobEvents.type,
        fromStatus: jobEvents.fromStatus,
        toStatus: jobEvents.toStatus,
        title: jobEvents.title,
        occurredAt: jobEvents.occurredAt,
        job: { id: jobs.id, title: jobs.title, company: jobs.company },
      })
      .from(jobEvents)
      .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
      .where(lte(jobEvents.occurredAt, new Date()))
      .orderBy(desc(jobEvents.occurredAt), desc(jobEvents.id))
      .limit(12);
  }

  /** Applications per week for the last few weeks, oldest first. Weeks start on Monday. */
  static weeklyApplications(
    appliedDates: string[],
    now = new Date(),
  ): { week: string; count: number }[] {
    const startOfWeek = (date: Date) => {
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      return start;
    };

    const current = startOfWeek(now);
    const weeks = Array.from({ length: WEEKS_OF_HISTORY }, (_, index) => {
      const week = new Date(current.getTime() - (WEEKS_OF_HISTORY - 1 - index) * 7 * DAY_MS);
      return { week: week.toISOString().slice(0, 10), count: 0 };
    });

    for (const date of appliedDates) {
      const week = startOfWeek(new Date(`${date}T00:00:00Z`))
        .toISOString()
        .slice(0, 10);
      const bucket = weeks.find((entry) => entry.week === week);
      if (bucket) bucket.count++;
    }
    return weeks;
  }
}
