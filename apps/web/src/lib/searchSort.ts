import type { JobDraft, SalaryPeriod, SearchResult } from '../api/types';

export const SEARCH_SORTS = {
  relevance: 'Relevance',
  newest: 'Newest',
  salary: 'Highest pay',
  company: 'Company A–Z',
} as const;
export type SearchSort = keyof typeof SEARCH_SORTS;

/** Rough multipliers that turn pay per period into pay per year, so boards can be compared. */
const PER_YEAR: Record<SalaryPeriod, number> = {
  year: 1,
  month: 12,
  week: 52,
  day: 260,
  hour: 2080,
};

/** The posting's pay range per year, or undefined when it lists no pay. */
function yearlyRange(draft: JobDraft): { low: number; high: number } | undefined {
  const low = draft.salaryMin ?? draft.salaryMax;
  const high = draft.salaryMax ?? draft.salaryMin;
  if (low == null || high == null) return undefined;
  const perYear = PER_YEAR[draft.salaryPeriod ?? 'year'];
  return { low: low * perYear, high: high * perYear };
}

function yearlyPay(draft: JobDraft): number | undefined {
  return yearlyRange(draft)?.high;
}

/** Yearly pay bounds; postings whose range overlaps them are kept. */
export interface SalaryFilter {
  min?: number;
  max?: number;
  hideUnlisted: boolean;
}

/** Minimum yearly pay presets; anything else is a custom range. */
export const SALARY_PRESETS: number[] = [50_000, 75_000, 100_000, 125_000, 150_000, 200_000];

/**
 * Whether the filter needs the custom range inputs. Hiding postings without pay with no
 * amount set counts as custom, so the checkbox stays on screen when the filter is restored.
 */
export function isCustomSalary(filter: SalaryFilter): boolean {
  if (filter.max != null) return true;
  if (filter.min == null) return filter.hideUnlisted;
  return !SALARY_PRESETS.includes(filter.min);
}

export function filterBySalary(results: SearchResult[], filter: SalaryFilter): SearchResult[] {
  return results.filter(({ draft }) => {
    const range = yearlyRange(draft);
    if (!range) return !filter.hideUnlisted;
    if (filter.min != null && range.high < filter.min) return false;
    if (filter.max != null && range.low > filter.max) return false;
    return true;
  });
}

/** Larger values first; missing values always go last. */
function descending(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

/** A sorted copy of the results. Relevance keeps the order the boards returned. */
export function sortResults(results: SearchResult[], sort: SearchSort): SearchResult[] {
  const sorted = [...results];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => descending(a.draft.postedOn, b.draft.postedOn));
    case 'salary':
      return sorted.sort((a, b) => descending(yearlyPay(a.draft), yearlyPay(b.draft)));
    case 'company':
      return sorted.sort((a, b) =>
        (a.draft.company ?? '').localeCompare(b.draft.company ?? '', undefined, {
          sensitivity: 'base',
        }),
      );
    default:
      return sorted;
  }
}
