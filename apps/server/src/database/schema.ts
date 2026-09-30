import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  EMPLOYMENT_TYPES,
  JOB_EVENT_TYPES,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORKPLACE_TYPES,
} from '../jobs/job.constants.js';
import type { UserPreferences } from '../users/preferences.js';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date()),
};

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserProfile {
  name: string;
  headline: string;
  resume: string;
  preferences: string;
}

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Stored lowercase; usernames are case-insensitive. */
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: USER_ROLES }).notNull().default('user'),
  /** Background the AI features use to personalize output. */
  profile: text('profile', { mode: 'json' }).$type<Partial<UserProfile>>().notNull().default({}),
  preferences: text('preferences', { mode: 'json' })
    .$type<Partial<UserPreferences>>()
    .notNull()
    .default({}),
  ...timestamps,
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 of the session token; the token itself only lives in the user's cookie. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /**
     * Nullable only because jobs created before accounts existed have no owner. They are
     * assigned to the first admin when the instance is set up.
     */
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location'),
    workplaceType: text('workplace_type', { enum: WORKPLACE_TYPES }),
    employmentType: text('employment_type', { enum: EMPLOYMENT_TYPES }),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('saved'),
    /** 1-5 rating of how excited the user is about the role. */
    interest: integer('interest'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period', { enum: SALARY_PERIODS }),
    url: text('url'),
    /** Where the posting was found, e.g. "LinkedIn" or "Workday". */
    source: text('source'),
    description: text('description'),
    notes: text('notes'),
    aiSummary: text('ai_summary'),
    coverLetter: text('cover_letter'),
    interviewPrep: text('interview_prep'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    // Calendar dates are stored as ISO strings (YYYY-MM-DD).
    postedOn: text('posted_on'),
    appliedOn: text('applied_on'),
    deadlineOn: text('deadline_on'),
    followUpOn: text('follow_up_on'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index('jobs_user_idx').on(table.userId),
    index('jobs_status_idx').on(table.status),
    index('jobs_company_idx').on(table.company),
  ],
);

export const jobEvents = sqliteTable(
  'job_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    type: text('type', { enum: JOB_EVENT_TYPES }).notNull(),
    fromStatus: text('from_status', { enum: JOB_STATUSES }),
    toStatus: text('to_status', { enum: JOB_STATUSES }),
    title: text('title'),
    body: text('body'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('job_events_job_idx').on(table.jobId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
});

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobEvent = typeof jobEvents.$inferSelect;
export type NewJobEvent = typeof jobEvents.$inferInsert;
