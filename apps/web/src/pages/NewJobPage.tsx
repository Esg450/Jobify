import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateJob, useViewedHunt } from '../api/hooks';
import type { JobDraft } from '../api/types';
import { ImportPanel } from '../components/ImportPanel';
import { JobForm } from '../components/JobForm';
import { PageHeader } from '../components/PageHeader';
import { errorText } from '../components/ui/feedback';

export function NewJobPage() {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  // The job joins the hunt on screen. Without one, the server starts a hunt for it.
  const { hunt } = useViewedHunt();
  const [draft, setDraft] = useState<{ values: JobDraft; version: number }>({
    values: {},
    version: 0,
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
          error={createJob.isError ? errorText(createJob.error) : undefined}
          onSubmit={(input) =>
            createJob.mutate(
              { ...input, huntId: hunt?.id },
              {
                onSuccess: (job) => navigate(`/jobs/${job.id}`, { replace: true }),
              },
            )
          }
          onCancel={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
