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
  /**
   * Set instead of the salary when the posting lists several ranges, usually by the
   * candidate's location, so the user can pick the one that applies to them.
   */
  salaryRanges?: SalaryRange[];
  url?: string;
  source?: string;
  /** Markdown. */
  description?: string;
  postedOn?: string;
  deadlineOn?: string;
}

/** One of several pay ranges a posting lists, usually by the candidate's location. */
export interface SalaryRange {
  /** Who the range applies to, e.g. "CA, WA, NY, NJ, CT", when the posting says. */
  label?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
}

export type SalaryFields = Pick<
  JobDraft,
  'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod' | 'salaryRanges'
>;

/** A single range fills the salary; several are left for the user to choose from. */
export function salaryFromRanges(ranges: SalaryRange[]): SalaryFields {
  if (ranges.length > 1) return { salaryRanges: ranges };
  const [range] = ranges;
  return {
    salaryMin: range?.salaryMin,
    salaryMax: range?.salaryMax,
    salaryCurrency: range?.salaryCurrency,
    salaryPeriod: range?.salaryPeriod,
  };
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
