// Mirrors the server's API responses (apps/server/src).

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

export type JobEventType = 'created' | 'status_change' | 'note' | 'interview' | 'follow_up';
export type ManualEventType = Extract<JobEventType, 'note' | 'interview' | 'follow_up'>;

export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string | null;
  workplaceType: WorkplaceType | null;
  employmentType: EmploymentType | null;
  status: JobStatus;
  interest: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  url: string | null;
  source: string | null;
  contactName: string | null;
  contactEmail: string | null;
  tags: string[];
  postedOn: string | null;
  appliedOn: string | null;
  deadlineOn: string | null;
  followUpOn: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  id: number;
  jobId: number;
  type: JobEventType;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  title: string | null;
  body: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface Job extends JobSummary {
  description: string | null;
  notes: string | null;
  aiSummary: string | null;
  coverLetter: string | null;
  interviewPrep: string | null;
  events: JobEvent[];
}

/** Writable job fields. */
export type JobInput = Partial<Omit<Job, 'id' | 'events' | 'createdAt' | 'updatedAt'>> &
  Pick<Job, 'title' | 'company'>;

export type JobSortField =
  'updatedAt' | 'createdAt' | 'appliedOn' | 'company' | 'title' | 'interest' | 'status';

export interface JobQuery {
  q?: string;
  status?: JobStatus[];
  workplaceType?: WorkplaceType[];
  archived?: boolean;
  sort?: JobSortField;
  order?: 'asc' | 'desc';
}

export interface EventInput {
  type: ManualEventType;
  title?: string | null;
  body?: string | null;
  occurredAt?: string;
}

/** A job with the history the timeline chart needs. */
export interface TimelineJob {
  id: number;
  title: string;
  company: string;
  status: JobStatus;
  appliedOn: string | null;
  createdAt: string;
  events: Pick<JobEvent, 'type' | 'fromStatus' | 'toStatus' | 'title' | 'occurredAt'>[];
}

export interface JobRef {
  id: number;
  title: string;
  company: string;
}

export interface Stats {
  total: number;
  active: number;
  applied: number;
  responseRate: number | null;
  byStatus: Record<JobStatus, number>;
  weekly: { week: string; count: number }[];
  upcoming: {
    type: 'interview' | 'follow_up' | 'deadline';
    date: string;
    label: string | null;
    job: JobRef;
  }[];
  recentActivity: (Pick<
    JobEvent,
    'id' | 'type' | 'fromStatus' | 'toStatus' | 'title' | 'occurredAt'
  > & {
    job: JobRef;
  })[];
}

export type JobDraft = Partial<
  Pick<
    Job,
    | 'title'
    | 'company'
    | 'location'
    | 'workplaceType'
    | 'employmentType'
    | 'salaryMin'
    | 'salaryMax'
    | 'salaryCurrency'
    | 'salaryPeriod'
    | 'url'
    | 'source'
    | 'description'
    | 'postedOn'
    | 'deadlineOn'
  >
>;

export interface ImportRequest {
  url?: string;
  html?: string;
  text?: string;
  useAi?: boolean;
}

export interface ImportResult {
  draft: JobDraft;
  sources: string[];
  warnings: string[];
}

export type AiProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'openai_compatible';

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultModel?: string;
  defaultBaseUrl?: string;
  modelHint: string;
}

export interface AiSettings {
  provider: AiProviderId | null;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  configured: boolean;
}

export interface AiSettingsInput {
  provider: AiProviderId | null;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export type AiTask = 'summary' | 'description' | 'cover-letter' | 'interview-prep';

export interface Profile {
  name: string;
  headline: string;
  resume: string;
  preferences: string;
}

/** Dashboard cards in their default order. Mirrors `users/preferences.ts` on the server. */
export const DASHBOARD_CARDS = [
  'active',
  'applied',
  'response_rate',
  'offers',
  'pipeline',
  'weekly',
  'upcoming',
  'activity',
] as const;
export type DashboardCard = (typeof DASHBOARD_CARDS)[number];

export interface DashboardLayout {
  /** Every card, visible or not, in display order. */
  order: DashboardCard[];
  hidden: DashboardCard[];
}

export interface Preferences {
  dashboard: DashboardLayout;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface UserInput {
  username: string;
  password: string;
  displayName?: string;
  role?: UserRole;
}

export interface AuthStatus {
  setupRequired: boolean;
  setupPasswordRequired: boolean;
  registrationOpen: boolean;
  user: User | null;
}
