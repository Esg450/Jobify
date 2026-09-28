import type {
  AiTask,
  EmploymentType,
  JobEventType,
  JobStatus,
  SalaryPeriod,
  WorkplaceType,
} from '../api/types';

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
};

/** Tailwind classes for each status: a tinted badge and a solid dot. */
export const STATUS_STYLES: Record<JobStatus, { badge: string; dot: string }> = {
  saved: {
    badge: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300',
    dot: 'bg-zinc-400',
  },
  applied: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  screening: {
    badge:
      'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  interviewing: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  offer: {
    badge:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  accepted: {
    badge: 'bg-green-100 text-green-800 ring-green-600/30 dark:bg-green-950 dark:text-green-300',
    dot: 'bg-green-600',
  },
  rejected: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  withdrawn: {
    badge: 'bg-zinc-100 text-zinc-500 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400',
    dot: 'bg-zinc-500',
  },
  ghosted: {
    badge: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
  freelance: 'Freelance',
};

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  year: 'per year',
  month: 'per month',
  week: 'per week',
  day: 'per day',
  hour: 'per hour',
};

export const EVENT_LABELS: Record<JobEventType, string> = {
  created: 'Added',
  status_change: 'Status changed',
  note: 'Note',
  interview: 'Interview',
  follow_up: 'Follow-up',
};

export const AI_TASK_LABELS: Record<AiTask, { title: string; action: string }> = {
  summary: { title: 'Summary', action: 'Summarize posting' },
  description: { title: 'Description', action: 'Tidy up description' },
  'cover-letter': { title: 'Cover letter', action: 'Draft cover letter' },
  'interview-prep': { title: 'Interview prep', action: 'Prepare for interviews' },
};
