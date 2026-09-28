import type { EmploymentType, SalaryPeriod, WorkplaceType } from '../jobs/job.constants.js';

/** Job fields extracted from a posting. Everything is optional: parsers fill in what they can. */
export interface JobDraft {
  title?: string;
  company?: string;
  location?: string;
  workplaceType?: WorkplaceType;
  employmentType?: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  url?: string;
  source?: string;
  /** Markdown. */
  description?: string;
  postedOn?: string;
  deadlineOn?: string;
}

export const REQUIRED_DRAFT_FIELDS = ['title', 'company', 'description'] as const;

export function isComplete(draft: JobDraft): boolean {
  return REQUIRED_DRAFT_FIELDS.every((field) => Boolean(draft[field]));
}

/** Copies fields from `extra` that are missing in `base`. */
export function fillMissing(base: JobDraft, extra: JobDraft): JobDraft {
  const merged: JobDraft = { ...base };
  for (const [key, value] of Object.entries(extra) as [keyof JobDraft, unknown][]) {
    if (value !== undefined && value !== null && value !== '' && !merged[key]) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
