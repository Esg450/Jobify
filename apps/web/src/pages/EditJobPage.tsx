import { useNavigate, useParams } from 'react-router';
import { useJob, useUpdateJob } from '../api/hooks';
import { JobForm } from '../components/JobForm';
import { PageHeader } from '../components/PageHeader';
import { Alert, errorText } from '../components/ui/feedback';
import { PageSpinner } from '../components/ui/Spinner';

export function EditJobPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: job, isPending, error } = useJob(id);
  const updateJob = useUpdateJob();

  if (isPending) return <PageSpinner />;
  if (error) return <Alert>{errorText(error)}</Alert>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Edit job" description={`${job.title} at ${job.company}`} />
      <JobForm
        initial={job}
        submitLabel="Save changes"
        submitting={updateJob.isPending}
        error={updateJob.isError ? errorText(updateJob.error) : undefined}
        onSubmit={(changes) =>
          updateJob.mutate(
            { id, changes },
            { onSuccess: () => navigate(`/jobs/${id}`, { replace: true }) },
          )
        }
        onCancel={() => navigate(`/jobs/${id}`)}
      />
    </div>
  );
}
