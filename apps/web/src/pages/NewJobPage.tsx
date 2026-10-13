import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useCreateJob, useViewedHunt } from '../api/hooks';
import type { JobDraft, JobInput } from '../api/types';
import { DuplicateJobDialog, duplicatesFromError } from '../components/DuplicateJobDialog';
import { ImportPanel } from '../components/ImportPanel';
import { JobForm } from '../components/JobForm';
import { PageHeader } from '../components/PageHeader';
import { errorText } from '../components/ui/feedback';

export function NewJobPage() {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  // The job joins the hunt on screen. Without one, the server starts a hunt for it.
  const { hunt } = useViewedHunt();
  // The Find jobs page hands over the posting to review through the router state.
  const handed = (useLocation().state as { draft?: JobDraft } | null)?.draft;
  const [draft, setDraft] = useState<{ values: JobDraft; version: number }>({
    values: handed ?? {},
    version: 0,
  });
  // The input the server refused as a duplicate, kept so "Add anyway" can resend it.
  const [pending, setPending] = useState<JobInput | null>(null);
  const duplicates = pending ? duplicatesFromError(createJob.error) : null;

  const save = (input: JobInput) =>
    createJob.mutate(input, {
      onSuccess: (job) => navigate(`/jobs/${job.id}`, { replace: true }),
      onError: (error) => setPending(duplicatesFromError(error) ? input : null),
    });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Add job"
        description={
          hunt?.endedOn
            ? `This job will be added to ${hunt.name}, which is finished.`
            : 'Import a posting or enter the details yourself.'
        }
      />
      <div className="flex flex-col gap-6">
        <ImportPanel
          onImported={({ draft: values }) =>
            setDraft((current) => ({ values, version: current.version + 1 }))
          }
        />
        <JobForm
          // Remount with fresh values after each import.
          key={draft.version}
          initial={draft.values}
          submitLabel="Save job"
          submitting={createJob.isPending}
          error={
            createJob.isError && !duplicatesFromError(createJob.error)
              ? errorText(createJob.error)
              : undefined
          }
          onSubmit={(input) => save({ ...input, huntId: hunt?.id })}
          onCancel={() => navigate(-1)}
        />
      </div>
      {pending && duplicates && (
        <DuplicateJobDialog
          duplicates={duplicates}
          saving={createJob.isPending}
          onCancel={() => {
            setPending(null);
            createJob.reset();
          }}
          onConfirm={() => save({ ...pending, allowDuplicate: true })}
        />
      )}
    </div>
  );
}
