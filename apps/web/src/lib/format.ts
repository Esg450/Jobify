import type { JobSummary, SalaryPeriod } from '../api/types';
import { SALARY_PERIOD_LABELS } from './labels';

const SHORT_PERIODS: Record<SalaryPeriod, string> = {
  year: '/yr',
  month: '/mo',
  week: '/wk',
  day: '/day',
  hour: '/hr',
};

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatSalary(
  job: Pick<JobSummary, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'>,
  { short = false } = {},
): string | null {
  const { salaryMin: min, salaryMax: max, salaryCurrency: currency, salaryPeriod: period } = job;
  if (!min && !max) return null;

  const format = (value: number) =>
    period === 'hour' ? value.toLocaleString() : compactNumber.format(value);
  const range = min && max && min !== max ? `${format(min)}–${format(max)}` : format((min ?? max)!);
  const amount = currency ? `${range} ${currency}` : range;
  if (!period) return amount;
  return short ? `${amount}${SHORT_PERIODS[period]}` : `${amount} ${SALARY_PERIOD_LABELS[period]}`;
}

/** Formats a YYYY-MM-DD date without shifting it across timezones. */
export function formatDate(
  date: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '';
  const value = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date);
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function formatRelative(date: string, now = Date.now()): string {
  const value =
    date.length === 10 ? new Date(`${date}T00:00:00`).getTime() : new Date(date).getTime();
  const diff = value - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relativeTime.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** Today's date as YYYY-MM-DD in the browser's timezone. */
export function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
