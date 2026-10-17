import { ArrowDown, ArrowUp, Columns3, Download, GanttChart, List, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useJobs, usePreferences, useUpdatePreferences } from '../api/hooks';
import {
  JOB_COLUMNS,
  type JobColumn,
  type JobQuery,
  type JobSortField,
  type JobSummary,
} from '../api/types';
import { InterestRating } from '../components/InterestRating';
import { JobFilters } from '../components/JobFilters';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TagList } from '../components/Tags';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { Checkbox } from '../components/ui/fields';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatDate, formatRelative, formatSalary } from '../lib/format';
import { WORKPLACE_LABELS } from '../lib/labels';
import { useJobFilters } from '../lib/useJobFilters';

export function JobsPage() {
  const [filters, setFilters] = useJobFilters();
  const { data: jobs, isPending, error } = useJobs(filters);
  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const hidden = preferences?.hiddenJobColumns ?? [];
  const columns = JOB_COLUMNS.filter((column) => !hidden.includes(column));

  return (
    <>
      <PageHeader
        title="Jobs"
        description={jobs ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : undefined}
        actions={
          <>
            <a
              href="/api/backup/csv"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </a>
            <ColumnPicker
              hidden={hidden}
              onChange={(hiddenJobColumns) => updatePreferences.mutate({ hiddenJobColumns })}
            />
            <ButtonLink to="/timeline" variant="ghost" icon={<GanttChart className="size-4" />}>
              Timeline chart
            </ButtonLink>
            <ButtonLink to="/jobs/new" variant="primary" icon={<Plus className="size-4" />}>
              Add job
            </ButtonLink>
          </>
        }
      />

      <JobFilters filters={filters} onChange={setFilters} />

      <Card className="mt-4 overflow-hidden">
        {isPending ? (
          <PageSpinner />
        ) : error ? (
          <div className="p-5">
            <Alert>{errorText(error)}</Alert>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<List className="size-6" />}
            title="No jobs found"
            description="Try different filters, or add a new job."
          />
        ) : (
          <JobTable
            jobs={jobs}
            columns={columns}
            sort={filters.sort}
            order={filters.order}
            onSort={setFilters}
          />
        )}
      </Card>
    </>
  );
}

/** Columns the table can sort by, and the order a first click uses. */
const SORTABLE: Partial<
  Record<JobColumn | 'role', { field: JobSortField; order: 'asc' | 'desc' }>
> = {
  role: { field: 'title', order: 'asc' },
  status: { field: 'status', order: 'asc' },
  interest: { field: 'interest', order: 'desc' },
  applied: { field: 'appliedOn', order: 'desc' },
  updated: { field: 'updatedAt', order: 'desc' },
};

interface JobTableProps {
  jobs: JobSummary[];
  columns: JobColumn[];
  sort?: JobSortField;
  order?: 'asc' | 'desc';
  onSort: (changes: Partial<JobQuery>) => void;
}

function JobTable({ jobs, columns, sort, order, onSort }: JobTableProps) {
  const navigate = useNavigate();

  const header = (column: JobColumn | 'role', label: string) => {
    const sortable = SORTABLE[column];
    if (!sortable) return label;
    const active: boolean = sort === sortable.field;
    const Arrow = order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() =>
          onSort({
            sort: sortable.field,
            order: active ? (order === 'asc' ? 'desc' : 'asc') : sortable.order,
          })
        }
        className={cn(
          'group inline-flex items-center gap-1 uppercase hover:text-zinc-900 dark:hover:text-zinc-100',
          active && 'text-zinc-900 dark:text-zinc-100',
        )}
      >
        {label}
        {active ? (
          <Arrow className="size-3.5" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5 opacity-0 group-hover:opacity-40" aria-hidden />
        )}
      </button>
    );
  };

  const ariaSort = (column: JobColumn | 'role') => {
    const sortable = SORTABLE[column];
    if (!sortable || sort !== sortable.field) return undefined;
    return order === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <>
      {/* Phones get a compact list instead of a wide table. */}
      <ul className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              to={`/jobs/${job.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{job.company}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                {job.workplaceType && <span>{WORKPLACE_LABELS[job.workplaceType]}</span>}
                {job.interest && <InterestRating value={job.interest} size="sm" />}
                <span className="ml-auto">{formatRelative(job.updatedAt)}</span>
              </div>
              <TagList tags={job.tags} className="mt-2" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-5 py-3" aria-sort={ariaSort('role')}>
                {header('role', 'Role')}
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  aria-sort={ariaSort(column)}
                  className={cn('px-3 py-3', column === 'updated' && 'px-5 text-right')}
                >
                  {header(column, COLUMN_LABELS[column])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <td className="max-w-72 px-5 py-3">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="truncate text-zinc-500 dark:text-zinc-400">{job.company}</p>
                </td>
                {columns.map((column) => (
                  <JobCell key={column} column={column} job={job} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const COLUMN_LABELS: Record<JobColumn, string> = {
  status: 'Status',
  location: 'Location',
  salary: 'Salary',
  tags: 'Tags',
  interest: 'Interest',
  applied: 'Applied',
  updated: 'Updated',
};

function JobCell({ column, job }: { column: JobColumn; job: JobSummary }) {
  switch (column) {
    case 'status':
      return (
        <td className="px-3 py-3">
          <StatusBadge status={job.status} />
        </td>
      );
    case 'location':
      return (
        <td className="max-w-48 px-3 py-3">
          <p className="truncate">{job.location ?? '–'}</p>
          {job.workplaceType && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {WORKPLACE_LABELS[job.workplaceType]}
            </p>
          )}
        </td>
      );
    case 'salary':
      return (
        <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
          {formatSalary(job, { short: true }) ?? '–'}
        </td>
      );
    case 'tags':
      return (
        <td className="max-w-64 min-w-40 px-3 py-3">
          {job.tags.length > 0 ? <TagList tags={job.tags} /> : '–'}
        </td>
      );
    case 'interest':
      return (
        <td className="px-3 py-3">
          <InterestRating value={job.interest} size="sm" />
        </td>
      );
    case 'applied':
      return (
        <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
          {job.appliedOn ? formatDate(job.appliedOn) : '–'}
        </td>
      );
    case 'updated':
      return (
        <td className="px-5 py-3 text-right whitespace-nowrap text-zinc-500">
          {formatRelative(job.updatedAt)}
        </td>
      );
  }
}

/** Shows or hides table columns; the choice is saved to the user's account. */
function ColumnPicker({
  hidden,
  onChange,
}: {
  hidden: JobColumn[];
  onChange: (hidden: JobColumn[]) => void;
}) {
  return (
    <details className="relative hidden md:block">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
        <Columns3 className="size-4" aria-hidden />
        Columns
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col gap-2 rounded-lg bg-white p-3 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        {JOB_COLUMNS.map((column) => (
          <Checkbox
            key={column}
            label={COLUMN_LABELS[column]}
            checked={!hidden.includes(column)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? hidden.filter((item) => item !== column)
                  : [...hidden, column],
              )
            }
          />
        ))}
      </div>
    </details>
  );
}
