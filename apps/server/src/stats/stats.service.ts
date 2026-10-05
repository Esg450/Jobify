import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, or, type SQL } from 'drizzle-orm';
import { today } from '../common/dates.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobEvents, jobs, type Job } from '../database/schema.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { ACTIVE_STATUSES, JOB_STATUSES, type JobStatus } from '../jobs/job.constants.js';

/** Statuses that mean the employer responded positively to an application. */
const RESPONDED_STATUSES: JobStatus[] = ['screening', 'interviewing', 'offer', 'accepted'];
const OFFER_STATUSES: JobStatus[] = ['offer', 'accepted'];
const WEEKS_OF_HISTORY = 12;
const UPCOMING_DAYS = 14;
const DAY_MS = 86_400_000;

type DatedJob = Pick<Job, 'id' | 'title' | 'company' | 'status' | 'followUpOn' | 'deadlineOn'>;

/** How one job hunt went, for looking back on it once it is over. */
export interface HuntSummary {
  huntId: number;
  jobs: number;
  applied: number;
  responseRate: number | null;
  interviews: number;
  /** Jobs that reached an offer, whether or not it was accepted. */
  offers: number;
  accepted: Pick<Job, 'id' | 'title' | 'company'> | null;
}

@Injectable()
export class StatsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly hunts: HuntsService,
  ) {}

  /** The dashboard for one hunt: the requested one, or the user's current hunt. */
  async overview(userId: number, huntId?: number) {
    const hunt = await this.hunts.resolve(userId, huntId);
    // Someone without a hunt has no jobs either; hunt ids start at 1, so 0 matches nothing.
    const scope = and(eq(jobs.userId, userId), eq(jobs.huntId, hunt?.id ?? 0))!;
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
      .where(and(scope, eq(jobs.archived, false)));

    const byStatus = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<
      JobStatus,
      number
    >;
    for (const job of allJobs) byStatus[job.status]++;

    const applied = allJobs.filter((job) => job.appliedOn);
    const respondedIds = await this.respondedJobIds(scope);
    const responded = applied.filter(
      (job) => respondedIds.has(job.id) || RESPONDED_STATUSES.includes(job.status),
    );

    return {
      total: allJobs.length,
      active: allJobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length,
      applied: applied.length,
      responseRate: applied.length ? responded.length / applied.length : null,
      byStatus,
      // A finished hunt shows its final weeks rather than an empty recent past.
      weekly: StatsService.weeklyApplications(
        applied.map((job) => job.appliedOn!),
        hunt?.endedOn ? new Date(`${hunt.endedOn}T00:00:00Z`) : undefined,
      ),
      upcoming: await this.upcoming(scope, allJobs),
      recentActivity: await this.recentActivity(scope),
    };
  }

  /** A summary of each of the user's hunts. Unlike the dashboard, archived jobs count. */
  async huntSummaries(userId: number): Promise<HuntSummary[]> {
    const [hunts, allJobs, events] = await Promise.all([
      this.hunts.list(userId),
      this.db
        .select({
          id: jobs.id,
          huntId: jobs.huntId,
          title: jobs.title,
          company: jobs.company,
          status: jobs.status,
          appliedOn: jobs.appliedOn,
        })
        .from(jobs)
        .where(eq(jobs.userId, userId)),
      this.db
        .select({ jobId: jobEvents.jobId, type: jobEvents.type, toStatus: jobEvents.toStatus })
        .from(jobEvents)
        .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
        .where(
          and(
            eq(jobs.userId, userId),
            or(eq(jobEvents.type, 'interview'), inArray(jobEvents.toStatus, RESPONDED_STATUSES)),
          ),
        ),
    ]);

    return hunts.map((hunt) => {
      const huntJobs = allJobs.filter((job) => job.huntId === hunt.id);
      const ids = new Set(huntJobs.map((job) => job.id));
      const huntEvents = events.filter((event) => ids.has(event.jobId));
      /** Jobs that are in one of the statuses now or passed through one earlier. */
      const reached = (statuses: JobStatus[]) =>
        huntJobs.filter(
          (job) =>
            statuses.includes(job.status) ||
            huntEvents.some(
              (event) =>
                event.jobId === job.id && event.toStatus && statuses.includes(event.toStatus),
            ),
        );

      const applied = huntJobs.filter((job) => job.appliedOn);
      const responded = reached(RESPONDED_STATUSES).filter((job) => job.appliedOn);
      const accepted = huntJobs.find((job) => job.status === 'accepted');
      return {
        huntId: hunt.id,
        jobs: huntJobs.length,
        applied: applied.length,
        responseRate: applied.length ? responded.length / applied.length : null,
        interviews: huntEvents.filter((event) => event.type === 'interview').length,
        offers: reached(OFFER_STATUSES).length,
        accepted: accepted
          ? { id: accepted.id, title: accepted.title, company: accepted.company }
          : null,
      };
    });
  }

  /** Jobs that reached a "responded" status at any point, even if later rejected. */
  private async respondedJobIds(scope: SQL): Promise<Set<number>> {
    const rows = await this.db
      .selectDistinct({ jobId: jobEvents.jobId })
      .from(jobEvents)
      .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
      .where(and(scope, inArray(jobEvents.toStatus, RESPONDED_STATUSES)));
    return new Set(rows.map((row) => row.jobId));
  }

  private async upcoming(scope: SQL, allJobs: DatedJob[]) {
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
          scope,
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

  private recentActivity(scope: SQL) {
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
      .where(and(scope, lte(jobEvents.occurredAt, new Date())))
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
