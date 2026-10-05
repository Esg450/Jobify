import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  ExternalLink,
  MapPin,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  useAiSettings,
  useDeleteJob,
  useHunts,
  useJob,
  useRunAiTask,
  useUpdateJob,
} from '../api/hooks';
import { JOB_STATUSES, type Job, type JobStatus } from '../api/types';
import { AiPanel } from '../components/AiPanel';
import { InterestRating } from '../components/InterestRating';
import { Markdown } from '../components/Markdown';
import { Timeline } from '../components/Timeline';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { Select, Textarea } from '../components/ui/fields';
import { Modal } from '../components/ui/Modal';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatDate, formatSalary } from '../lib/format';
import { EMPLOYMENT_LABELS, STATUS_LABELS, STATUS_STYLES, WORKPLACE_LABELS } from '../lib/labels';

type Tab = 'description' | 'ai' | 'notes';

export function JobDetailPage() {
  const id = Number(useParams().id);
  const { data: job, isPending, error } = useJob(id);
  const updateJob = useUpdateJob();
  const [tab, setTab] = useState<Tab>('description');

  if (isPending) return <PageSpinner />;
  if (error) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" />}
        title="Job not found"
        description={errorText(error)}
        action={<ButtonLink to="/jobs">Back to jobs</ButtonLink>}
      />
    );
  }

  const update = (changes: Partial<Job>) => updateJob.mutate({ id, changes });

  return (
    <>
      <Link
        to="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All jobs
      </Link>

      <JobHeader job={job} onStatusChange={(status) => update({ status })} />
      {updateJob.isError && <Alert className="mb-4">{errorText(updateJob.error)}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <div
              className="flex gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800"
              role="tablist"
            >
              {(
                [
                  ['description', 'Description'],
                  ['ai', 'AI assistant'],
                  ['notes', 'Notes'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    tab === value
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="p-5" role="tabpanel">
              {tab === 'description' && <DescriptionTab job={job} />}
              {tab === 'ai' && <AiPanel job={job} />}
              {tab === 'notes' && (
                <NotesTab
                  job={job}
                  onSave={(notes) => update({ notes })}
                  saving={updateJob.isPending}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <DetailsCard
            job={job}
            onInterestChange={(interest) => update({ interest })}
            onHuntChange={(huntId) => update({ huntId })}
          />
          <Timeline jobId={job.id} events={job.events} />
        </div>
      </div>
    </>
  );
}

function JobHeader({
  job,
  onStatusChange,
}: {
  job: Job;
  onStatusChange: (status: JobStatus) => void;
}) {
  const navigate = useNavigate();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-4" aria-hidden />
            {job.company}
          </span>
          {(job.location || job.workplaceType) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {[job.location, job.workplaceType && WORKPLACE_LABELS[job.workplaceType]]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          {job.archived && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
              Archived
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full',
              STATUS_STYLES[job.status].dot,
            )}
          />
          <Select
            aria-label="Status"
            className="w-auto pl-7 font-medium"
            value={job.status}
            onChange={(event) => onStatusChange(event.target.value as JobStatus)}
          >
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="size-4" aria-hidden />
            Posting
          </a>
        )}
        <ButtonLink to={`/jobs/${job.id}/edit`} icon={<Pencil className="size-4" />}>
          Edit
        </ButtonLink>
        <Button
          variant="ghost"
          title={job.archived ? 'Unarchive' : 'Archive'}
          aria-label={job.archived ? 'Unarchive' : 'Archive'}
          loading={updateJob.isPending}
          onClick={() => updateJob.mutate({ id: job.id, changes: { archived: !job.archived } })}
          icon={
            job.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />
          }
        />
        <Button
          variant="ghost"
          title="Delete"
          aria-label="Delete"
          onClick={() => setConfirmingDelete(true)}
          icon={<Trash2 className="size-4" />}
        />
      </div>

      <Modal
        open={confirmingDelete}
        title="Delete this job?"
        onClose={() => setConfirmingDelete(false)}
        footer={
          <>
            <Button onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteJob.isPending}
              onClick={() =>
                deleteJob.mutate(job.id, { onSuccess: () => navigate('/jobs', { replace: true }) })
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {job.title} at {job.company} and its timeline will be removed permanently. Archive it
          instead if you might want it later.
        </p>
      </Modal>
    </div>
  );
}

function DescriptionTab({ job }: { job: Job }) {
  const { data: ai } = useAiSettings();
  const tidy = useRunAiTask(job.id);

  if (!job.description) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No description yet.{' '}
        <Link
          to={`/jobs/${job.id}/edit`}
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      {ai?.configured && (
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            icon={<Sparkles className="size-3.5" />}
            loading={tidy.isPending}
            onClick={() => tidy.mutate('description')}
            title="Rewrite the description as clean, structured Markdown"
          >
            Tidy up with AI
          </Button>
        </div>
      )}
      {tidy.isError && <Alert className="mb-4">{errorText(tidy.error)}</Alert>}
      <Markdown>{job.description}</Markdown>
    </>
  );
}

function NotesTab({
  job,
  onSave,
  saving,
}: {
  job: Job;
  onSave: (notes: string | null) => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(job.notes ?? '');
  const dirty = notes !== (job.notes ?? '');

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        aria-label="Notes"
        rows={12}
        placeholder="Anything worth remembering: who referred you, salary expectations, impressions from calls…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!dirty}
          loading={saving}
          onClick={() => onSave(notes.trim() || null)}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}

function DetailsCard({
  job,
  onInterestChange,
  onHuntChange,
}: {
  job: Job;
  onInterestChange: (interest: number | null) => void;
  onHuntChange: (huntId: number) => void;
}) {
  const { data: hunts = [] } = useHunts();
  const salary = formatSalary(job);
  const dates: [string, string | null][] = [
    ['Posted', job.postedOn],
    ['Applied', job.appliedOn],
    ['Deadline', job.deadlineOn],
    ['Follow up', job.followUpOn],
  ];

  return (
    <Card>
      <CardHeader title="Details" />
      <dl className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        <Detail label="Interest">
          <InterestRating value={job.interest} onChange={onInterestChange} />
        </Detail>
        {/* Moving a job only makes sense once there is more than one hunt. */}
        {hunts.length > 1 && job.huntId !== null && (
          <Detail label="Job hunt">
            <Select
              aria-label="Job hunt"
              className="w-auto max-w-48 py-1"
              value={job.huntId}
              onChange={(event) => onHuntChange(Number(event.target.value))}
            >
              {hunts.map((hunt) => (
                <option key={hunt.id} value={hunt.id}>
                  {hunt.name}
                </option>
              ))}
            </Select>
          </Detail>
        )}
        {salary && <Detail label="Salary">{salary}</Detail>}
        {job.employmentType && (
          <Detail label="Employment">{EMPLOYMENT_LABELS[job.employmentType]}</Detail>
        )}
        {job.source && <Detail label="Source">{job.source}</Detail>}
        {dates
          .filter(([, date]) => date)
          .map(([label, date]) => (
            <Detail key={label} label={label}>
              {formatDate(date)}
            </Detail>
          ))}
        {(job.contactName || job.contactEmail) && (
          <Detail label="Contact">
            <span className="block">{job.contactName}</span>
            {job.contactEmail && (
              <a
                href={`mailto:${job.contactEmail}`}
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {job.contactEmail}
              </a>
            )}
          </Detail>
        )}
        {job.tags.length > 0 && (
          <Detail label="Tags">
            <div className="flex flex-wrap justify-end gap-1">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Detail>
        )}
      </dl>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
