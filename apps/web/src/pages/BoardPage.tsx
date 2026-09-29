import { useQueryClient } from '@tanstack/react-query';
import { Maximize2, Minimize2, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { queryKeys, useJobs, useUpdateJob } from '../api/hooks';
import { JOB_STATUSES, type JobQuery, type JobStatus, type JobSummary } from '../api/types';
import { InterestRating } from '../components/InterestRating';
import { JobFilters } from '../components/JobFilters';
import { PageHeader } from '../components/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Alert, errorText } from '../components/ui/feedback';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatSalary } from '../lib/format';
import { STATUS_LABELS, STATUS_STYLES, WORKPLACE_LABELS } from '../lib/labels';
import { useJobFilters } from '../lib/useJobFilters';

const DRAG_TYPE = 'application/x-jobify-job';

export function BoardPage() {
  const [filters, setFilters] = useJobFilters();
  const query: JobQuery = { ...filters, status: [], sort: 'interest', order: 'desc' };
  const { data: jobs, isPending, error } = useJobs(query);
  const updateJob = useUpdateJob();
  const queryClient = useQueryClient();
  const [dropTarget, setDropTarget] = useState<JobStatus | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === board.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    // Browsers only allow this from a real click and may still refuse; there is nothing
    // useful to show if they do, so the button simply stays as it is.
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : board.current?.requestFullscreen();
    request?.catch(() => setFullscreen(false));
  };

  const moveJob = (jobId: number, status: JobStatus) => {
    const job = jobs?.find((candidate) => candidate.id === jobId);
    if (!job || job.status === status) return;

    // Move the card immediately; the mutation refreshes the list when it settles.
    queryClient.setQueryData<JobSummary[]>(queryKeys.jobList(query), (current) =>
      current?.map((candidate) => (candidate.id === jobId ? { ...candidate, status } : candidate)),
    );
    updateJob.mutate({ id: jobId, changes: { status } });
  };

  const onDrop = (event: DragEvent, status: JobStatus) => {
    event.preventDefault();
    setDropTarget(null);
    const jobId = Number(event.dataTransfer.getData(DRAG_TYPE));
    if (jobId) moveJob(jobId, status);
  };

  return (
    <div
      ref={board}
      className={cn(
        'flex flex-1 flex-col',
        fullscreen && 'overflow-auto bg-zinc-50 p-6 dark:bg-zinc-950',
      )}
    >
      <PageHeader
        title="Board"
        description="Drag cards between columns to update their status."
        actions={
          <>
            {typeof document.documentElement.requestFullscreen === 'function' && (
              <Button
                variant="ghost"
                icon={
                  fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />
                }
                onClick={toggleFullscreen}
              >
                {fullscreen ? 'Exit full screen' : 'Full screen'}
              </Button>
            )}
            <ButtonLink to="/jobs/new" variant="primary" icon={<Plus className="size-4" />}>
              Add job
            </ButtonLink>
          </>
        }
      />
      <JobFilters filters={filters} onChange={setFilters} showStatus={false} showSort={false} />
      {updateJob.isError && <Alert className="mt-4">{errorText(updateJob.error)}</Alert>}

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <Alert className="mt-4">{errorText(error)}</Alert>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto pb-2">
          {JOB_STATUSES.map((status) => {
            const columnJobs = jobs.filter((job) => job.status === status);
            return (
              <section
                key={status}
                aria-label={STATUS_LABELS[status]}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                  event.preventDefault();
                  setDropTarget(status);
                }}
                onDragLeave={() =>
                  setDropTarget((current) => (current === status ? null : current))
                }
                onDrop={(event) => onDrop(event, status)}
                className={cn(
                  'flex w-72 shrink-0 snap-start flex-col rounded-xl bg-zinc-100/80 p-2 transition-colors dark:bg-zinc-900/60',
                  'max-h-[calc(100dvh-14rem)]',
                  dropTarget === status &&
                    'bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-950/40',
                )}
              >
                <header className="flex items-center justify-between px-2 py-1.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      aria-hidden
                      className={cn('size-2 rounded-full', STATUS_STYLES[status].dot)}
                    />
                    {STATUS_LABELS[status]}
                  </h2>
                  <span className="text-xs text-zinc-500 tabular-nums">{columnJobs.length}</span>
                </header>
                <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto">
                  {columnJobs.map((job) => (
                    <BoardCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardCard({ job }: { job: JobSummary }) {
  const salary = formatSalary(job, { short: true });
  return (
    <Link
      to={`/jobs/${job.id}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, String(job.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      className="block cursor-grab rounded-lg bg-white p-3 shadow-sm ring-1 ring-zinc-200 transition-shadow hover:shadow-md active:cursor-grabbing dark:bg-zinc-900 dark:ring-zinc-800"
    >
      <p className="text-sm leading-snug font-medium">{job.title}</p>
      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{job.company}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {job.workplaceType && <span>{WORKPLACE_LABELS[job.workplaceType]}</span>}
        {salary && <span>{salary}</span>}
      </div>
      {job.interest && (
        <div className="mt-2">
          <InterestRating value={job.interest} size="sm" />
        </div>
      )}
    </Link>
  );
}
