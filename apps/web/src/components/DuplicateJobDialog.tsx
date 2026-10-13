import { Link } from 'react-router';
import { ApiError } from '../api/client';
import type { DuplicateJob } from '../api/types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { StatusBadge } from './StatusBadge';

/** The jobs a 409 from `POST /jobs` says the new one repeats, or null for any other error. */
export function duplicatesFromError(error: unknown): DuplicateJob[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const { duplicates } = (error.body ?? {}) as { duplicates?: DuplicateJob[] };
  return Array.isArray(duplicates) && duplicates.length > 0 ? duplicates : null;
}

/**
 * Warns that the job being saved matches one the user already has and lets them look at the
 * existing jobs, give up, or save anyway.
 */
export function DuplicateJobDialog({
  duplicates,
  saving,
  onCancel,
  onConfirm,
}: {
  duplicates: DuplicateJob[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      title="This job already exists"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={onConfirm}>
            Add anyway
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {duplicates.length === 1
          ? 'You already have a job with the same link, or the same title and company.'
          : `You already have ${duplicates.length} jobs with the same link, or the same title and company.`}
      </p>
      <ul className="mt-3 divide-y divide-zinc-200 rounded-lg ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800">
        {duplicates.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <Link
                to={`/jobs/${job.id}`}
                target="_blank"
                className="block truncate text-sm font-medium hover:underline"
              >
                {job.title}
              </Link>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {job.company}
                {job.hunt && ` · ${job.hunt.name}`}
                {job.archived && ' · Archived'}
              </p>
            </div>
            <StatusBadge status={job.status} className="shrink-0" />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
