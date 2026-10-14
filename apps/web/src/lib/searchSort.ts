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

function yearlyPay(draft: JobDraft): number | undefined {
  const amount = draft.salaryMax ?? draft.salaryMin;
  if (amount == null) return undefined;
  return amount * PER_YEAR[draft.salaryPeriod ?? 'year'];
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
