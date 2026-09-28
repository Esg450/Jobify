import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { JOB_STATUSES, WORKPLACE_TYPES, type JobQuery, type JobSortField } from '../api/types';
import { cn } from '../lib/cn';
import { STATUS_LABELS, STATUS_STYLES, WORKPLACE_LABELS } from '../lib/labels';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { useJobFilters } from '../lib/useJobFilters';
import { Checkbox, Input, Select } from './ui/fields';

const SORT_OPTIONS: { value: JobSortField; label: string }[] = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'createdAt', label: 'Recently added' },
  { value: 'appliedOn', label: 'Date applied' },
  { value: 'interest', label: 'Interest' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
];

type Filters = ReturnType<typeof useJobFilters>[0];

interface JobFiltersProps {
  filters: Filters;
  onChange: (changes: Partial<JobQuery>) => void;
  showStatus?: boolean;
  showSort?: boolean;
}

export function JobFilters({
  filters,
  onChange,
  showStatus = true,
  showSort = true,
}: JobFiltersProps) {
  const [search, setSearch] = useState(filters.q ?? '');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (debouncedSearch !== filters.q) onChange({ q: debouncedSearch });
    // Only react to the debounced text; `filters` changes on every URL update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const toggleStatus = (status: (typeof JOB_STATUSES)[number]) =>
    onChange({
      status: filters.status.includes(status)
        ? filters.status.filter((item) => item !== status)
        : [...filters.status, status],
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search title, company or location"
            aria-label="Search jobs"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Workplace"
          className="w-auto"
          value={filters.workplaceType[0] ?? ''}
          onChange={(event) =>
            onChange({
              workplaceType: event.target.value
                ? [event.target.value as (typeof WORKPLACE_TYPES)[number]]
                : [],
            })
          }
        >
          <option value="">Any workplace</option>
          {WORKPLACE_TYPES.map((type) => (
            <option key={type} value={type}>
              {WORKPLACE_LABELS[type]}
            </option>
          ))}
        </Select>
        {showSort && (
          <Select
            aria-label="Sort by"
            className="w-auto"
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(':') as [JobSortField, 'asc' | 'desc'];
              onChange({ sort, order });
            }}
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <optgroup key={value} label={label}>
                <option value={`${value}:desc`}>{label} ↓</option>
                <option value={`${value}:asc`}>{label} ↑</option>
              </optgroup>
            ))}
          </Select>
        )}
        <Checkbox
          label="Archived"
          checked={filters.archived ?? false}
          onChange={(event) => onChange({ archived: event.target.checked })}
        />
      </div>

      {showStatus && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {JOB_STATUSES.map((status) => {
            const active = filters.status.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ring-inset',
                  active
                    ? STATUS_STYLES[status].badge
                    : 'text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800',
                )}
              >
                <span
                  aria-hidden
                  className={cn('size-1.5 rounded-full', STATUS_STYLES[status].dot)}
                />
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
