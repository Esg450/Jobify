export const JOB_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Statuses that mean the application is still in progress. */
export const ACTIVE_STATUSES: readonly JobStatus[] = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
];

export const WORKPLACE_TYPES = ['remote', 'hybrid', 'onsite'] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
  'freelance',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SALARY_PERIODS = ['year', 'month', 'week', 'day', 'hour'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const JOB_EVENT_TYPES = [
  'created',
  'status_change',
  'note',
  'interview',
  'follow_up',
] as const;
export type JobEventType = (typeof JOB_EVENT_TYPES)[number];
