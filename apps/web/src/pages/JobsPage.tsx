import { Download, List, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useJobs } from '../api/hooks';
import type { JobSummary } from '../api/types';
import { InterestRating } from '../components/InterestRating';
import { JobFilters } from '../components/JobFilters';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { PageSpinner } from '../components/ui/Spinner';
import { formatDate, formatRelative, formatSalary } from '../lib/format';
import { WORKPLACE_LABELS } from '../lib/labels';
import { useJobFilters } from '../lib/useJobFilters';

export function JobsPage() {
  const [filters, setFilters] = useJobFilters();
  const { data: jobs, isPending, error } = useJobs(filters);

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
          <JobTable jobs={jobs} />
        )}
      </Card>
    </>
  );
}

function JobTable({ jobs }: { jobs: JobSummary[] }) {
  const navigate = useNavigate();

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
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-5 py-3">
                Role
              </th>
              <th scope="col" className="px-3 py-3">
                Status
              </th>
              <th scope="col" className="px-3 py-3">
                Location
              </th>
              <th scope="col" className="px-3 py-3">
                Salary
              </th>
              <th scope="col" className="px-3 py-3">
                Interest
              </th>
              <th scope="col" className="px-3 py-3">
                Applied
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Updated
              </th>
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
                <td className="px-3 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="max-w-48 px-3 py-3">
                  <p className="truncate">{job.location ?? '–'}</p>
                  {job.workplaceType && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {WORKPLACE_LABELS[job.workplaceType]}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                  {formatSalary(job, { short: true }) ?? '–'}
                </td>
                <td className="px-3 py-3">
                  <InterestRating value={job.interest} size="sm" />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                  {job.appliedOn ? formatDate(job.appliedOn) : '–'}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-zinc-500">
                  {formatRelative(job.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
