import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  JOB_STATUSES,
  WORKPLACE_TYPES,
  type JobQuery,
  type JobSortField,
  type WorkplaceType,
} from '../api/types';
import { cn } from '../lib/cn';
import { STATUS_LABELS, STATUS_STYLES, WORKPLACE_LABELS } from '../lib/labels';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { useJobFilters } from '../lib/useJobFilters';
import { TagChecklist } from './Tags';
import { Checkbox, Field, Input, Select } from './ui/fields';

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
        <FiltersMenu filters={filters} onChange={onChange} />
        {/* Wider screens sort by clicking the Jobs table's column headers. */}
        {showSort && (
          <Select
            aria-label="Sort by"
            className="min-w-36 flex-1 sm:w-auto sm:flex-none md:hidden"
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
      </div>

      {showStatus && (
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Filter by status"
        >
          {JOB_STATUSES.map((status) => {
            const active = filters.status.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ring-inset focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none sm:py-1',
                  active
                    ? STATUS_STYLES[status].badge
                    : 'text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800/70',
                )}
              >
                {active ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className={cn('size-1.5 rounded-full', STATUS_STYLES[status].dot)}
                  />
                )}
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FiltersMenuProps {
  filters: Filters;
  onChange: (changes: Partial<JobQuery>) => void;
}

/** The "Filters" button: workplace, tags and archived jobs in a dropdown panel. */
function FiltersMenu({ filters, onChange }: FiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count: number =
    filters.workplaceType.length + filters.tags.length + (filters.archived ? 1 : 0);

  // Close on a click outside or Escape, like a native select.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative flex-1 sm:flex-none"
      // Close when keyboard focus leaves the panel.
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !root.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800"
      >
        <SlidersHorizontal className="size-4 text-zinc-400" aria-hidden />
        Filters
        {count > 0 && (
          <span className="rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn('ml-auto size-4 text-zinc-400 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filters"
          className="absolute right-0 z-20 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-lg bg-white p-4 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          <Field label="Workplace">
            {(id) => (
              <Select
                id={id}
                value={filters.workplaceType[0] ?? ''}
                onChange={(event) =>
                  onChange({
                    workplaceType: event.target.value ? [event.target.value as WorkplaceType] : [],
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
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tags</span>
            <TagChecklist value={filters.tags} onChange={(tags) => onChange({ tags })} />
          </div>
          <Checkbox
            label="Show archived jobs"
            checked={filters.archived ?? false}
            onChange={(event) => onChange({ archived: event.target.checked })}
          />
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange({ workplaceType: [], tags: [], archived: false })}
              className="self-start text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
