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

/** One job search. A hunt without an end date is the active one; a user has at most one. */
export interface JobHunt {
  id: number;
  name: string;
  startedOn: string;
  endedOn: string | null;
  createdAt: string;
  jobCount: number;
}

export interface HuntInput {
  name: string;
  startedOn?: string;
  /** A date finishes the hunt; `null` reopens it. Only when updating. */
  endedOn?: string | null;
}

/** How a hunt went. Unlike the dashboard's numbers, archived jobs count. */
export interface HuntSummary {
  huntId: number;
  jobs: number;
  applied: number;
  responseRate: number | null;
  interviews: number;
  offers: number;
  accepted: JobRef | null;
}

export interface JobSummary {
  id: number;
  huntId: number | null;
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
  Pick<Job, 'title' | 'company'> & {
    /** Save even if the job matches one the user already has (see `DuplicateJob`). */
    allowDuplicate?: boolean;
  };

/**
 * An existing job that a new one repeats: same URL (ignoring tracking parameters) or same
 * title and company. `POST /jobs` answers 409 with `{ duplicates }` unless `allowDuplicate` is set.
 */
export interface DuplicateJob {
  id: number;
  title: string;
  company: string;
  url: string | null;
  status: JobStatus;
  archived: boolean;
  hunt: { id: number; name: string } | null;
}

export type JobSortField =
  'updatedAt' | 'createdAt' | 'appliedOn' | 'company' | 'title' | 'interest' | 'status';

export interface JobQuery {
  /** Defaults to the current hunt. */
  huntId?: number;
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

/** The job boards JobSpy can search (apps/server/src/search/search.constants.ts). */
export const SEARCH_SITES = {
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  zip_recruiter: 'ZipRecruiter',
  glassdoor: 'Glassdoor',
  google: 'Google Jobs',
  bayt: 'Bayt',
  naukri: 'Naukri',
  bdjobs: 'BDJobs',
  hellowork: 'HelloWork',
} as const;
export type SearchSite = keyof typeof SEARCH_SITES;
export const DEFAULT_SEARCH_SITES: SearchSite[] = ['indeed', 'linkedin'];

export const SEARCH_JOB_TYPES = ['fulltime', 'parttime', 'contract', 'internship'] as const;
export type SearchJobType = (typeof SEARCH_JOB_TYPES)[number];
export const SEARCH_JOB_TYPE_LABELS: Record<SearchJobType, string> = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export const MAX_SEARCH_RESULTS = 100;

export interface SearchSettings {
  enabled: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  /** Whether the Find jobs page is available. */
  configured: boolean;
  /** Boards selected by default on the Find jobs page. */
  defaultSites: SearchSite[];
  /** Country for Indeed and Glassdoor when a search does not name one. */
  country: string;
  /** Search radius in miles; null leaves it to JobSpy (50). */
  distance: number | null;
  /** Fetch each LinkedIn posting for its description (slower). */
  fetchDescriptions: boolean;
  /** Convert hourly, weekly and monthly pay to yearly figures. */
  annualSalaries: boolean;
  /** How many proxies are saved; the proxies themselves are never returned. */
  proxyCount: number;
}

export interface SearchSettingsInput {
  enabled: boolean;
  baseUrl?: string;
  /** Omit to keep the saved key; an empty string removes it. */
  apiKey?: string;
  defaultSites?: SearchSite[];
  country?: string;
  distance?: number | null;
  fetchDescriptions?: boolean;
  annualSalaries?: boolean;
  /** Omit to keep the saved proxies; an empty string removes them. */
  proxies?: string;
}

export interface SearchTestInput {
  baseUrl?: string;
  apiKey?: string;
}

export interface SearchTestResult {
  version: string | null;
  sites: string[];
}

export interface SearchQuery {
  terms: string;
  location?: string;
  sites?: SearchSite[];
  remote?: boolean;
  /** Only postings from the last N hours. */
  hoursOld?: number;
  jobType?: SearchJobType;
  /** Country for Indeed and Glassdoor, e.g. "USA" or "UK". */
  country?: string;
  limit?: number;
}

/** One posting found on a job board. `existing` is set when the user already has it. */
export interface SearchResult {
  id: string;
  site: string;
  draft: JobDraft;
  existing: DuplicateJob | null;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Boards that returned nothing, which usually means they are rate limiting the service. */
  warnings: string[];
}

export interface SearchCandidate {
  id: string;
  title: string;
  company: string;
  url?: string;
}

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
