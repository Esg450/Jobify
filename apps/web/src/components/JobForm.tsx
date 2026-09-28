import { Eye, Pencil } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORKPLACE_TYPES,
  type Job,
  type JobInput,
} from '../api/types';
import {
  EMPLOYMENT_LABELS,
  SALARY_PERIOD_LABELS,
  STATUS_LABELS,
  WORKPLACE_LABELS,
} from '../lib/labels';
import { InterestRating } from './InterestRating';
import { Markdown } from './Markdown';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { Alert } from './ui/feedback';
import { Field, Input, Select, Textarea } from './ui/fields';

/** Form values are kept as strings so inputs stay controlled; they are converted on submit. */
type FormValues = Record<
  | 'title'
  | 'company'
  | 'url'
  | 'source'
  | 'location'
  | 'workplaceType'
  | 'employmentType'
  | 'salaryMin'
  | 'salaryMax'
  | 'salaryCurrency'
  | 'salaryPeriod'
  | 'status'
  | 'postedOn'
  | 'appliedOn'
  | 'deadlineOn'
  | 'followUpOn'
  | 'contactName'
  | 'contactEmail'
  | 'tags'
  | 'description'
  | 'notes',
  string
> & { interest: number | null };

function toFormValues(job: Partial<Job>): FormValues {
  const text = (value: string | number | null | undefined) =>
    value === null || value === undefined ? '' : String(value);
  return {
    title: text(job.title),
    company: text(job.company),
    url: text(job.url),
    source: text(job.source),
    location: text(job.location),
    workplaceType: text(job.workplaceType),
    employmentType: text(job.employmentType),
    salaryMin: text(job.salaryMin),
    salaryMax: text(job.salaryMax),
    salaryCurrency: text(job.salaryCurrency),
    salaryPeriod: text(job.salaryPeriod ?? 'year'),
    status: text(job.status ?? 'saved'),
    postedOn: text(job.postedOn),
    appliedOn: text(job.appliedOn),
    deadlineOn: text(job.deadlineOn),
    followUpOn: text(job.followUpOn),
    contactName: text(job.contactName),
    contactEmail: text(job.contactEmail),
    tags: (job.tags ?? []).join(', '),
    description: text(job.description),
    notes: text(job.notes),
    interest: job.interest ?? null,
  };
}

function toJobInput(values: FormValues): JobInput {
  const optional = (value: string) => value.trim() || null;
  const number = (value: string) => (value.trim() ? Math.round(Number(value)) : null);
  const hasSalary = Boolean(values.salaryMin.trim() || values.salaryMax.trim());

  return {
    title: values.title.trim(),
    company: values.company.trim(),
    url: optional(values.url),
    source: optional(values.source),
    location: optional(values.location),
    workplaceType: (optional(values.workplaceType) as JobInput['workplaceType']) ?? null,
    employmentType: (optional(values.employmentType) as JobInput['employmentType']) ?? null,
    salaryMin: number(values.salaryMin),
    salaryMax: number(values.salaryMax),
    salaryCurrency: hasSalary ? (optional(values.salaryCurrency)?.toUpperCase() ?? null) : null,
    salaryPeriod: hasSalary
      ? ((optional(values.salaryPeriod) as JobInput['salaryPeriod']) ?? null)
      : null,
    status: values.status as JobInput['status'],
    interest: values.interest,
    postedOn: optional(values.postedOn),
    appliedOn: optional(values.appliedOn),
    deadlineOn: optional(values.deadlineOn),
    followUpOn: optional(values.followUpOn),
    contactName: optional(values.contactName),
    contactEmail: optional(values.contactEmail),
    tags: [
      ...new Set(
        values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ],
    description: optional(values.description),
    notes: optional(values.notes),
  };
}

interface JobFormProps {
  initial: Partial<Job>;
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: (input: JobInput) => void;
  onCancel: () => void;
}

export function JobForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: JobFormProps) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [previewDescription, setPreviewDescription] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const bind = (key: Exclude<keyof FormValues, 'interest'>) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(toJobInput(values));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && <Alert>{error}</Alert>}

      <Section title="Role">
        <Field label="Job title">
          {(id) => <Input id={id} required maxLength={300} {...bind('title')} />}
        </Field>
        <Field label="Company">
          {(id) => <Input id={id} required maxLength={300} {...bind('company')} />}
        </Field>
        <Field label="Posting URL">
          {(id) => <Input id={id} type="url" placeholder="https://" {...bind('url')} />}
        </Field>
        <Field label="Source" hint="Where you found it, e.g. LinkedIn or a referral.">
          {(id) => <Input id={id} maxLength={100} {...bind('source')} />}
        </Field>
      </Section>

      <Section title="Details">
        <Field label="Location">
          {(id) => <Input id={id} placeholder="City, region or country" {...bind('location')} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Workplace">
            {(id) => (
              <Select id={id} {...bind('workplaceType')}>
                <option value="">Not specified</option>
                {WORKPLACE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WORKPLACE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Employment">
            {(id) => (
              <Select id={id} {...bind('employmentType')}>
                <option value="">Not specified</option>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYMENT_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
          <Field label="Salary from">
            {(id) => (
              <Input id={id} type="number" min={0} inputMode="numeric" {...bind('salaryMin')} />
            )}
          </Field>
          <Field label="Salary to">
            {(id) => (
              <Input id={id} type="number" min={0} inputMode="numeric" {...bind('salaryMax')} />
            )}
          </Field>
          <Field label="Currency">
            {(id) => (
              <Input
                id={id}
                maxLength={3}
                placeholder="USD"
                className="uppercase"
                {...bind('salaryCurrency')}
              />
            )}
          </Field>
          <Field label="Period">
            {(id) => (
              <Select id={id} {...bind('salaryPeriod')}>
                {SALARY_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {SALARY_PERIOD_LABELS[period]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Tracking">
        <Field label="Status">
          {(id) => (
            <Select id={id} {...bind('status')}>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Interest
          </span>
          <InterestRating
            value={values.interest}
            onChange={(interest) => set('interest', interest)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
          <Field label="Posted">
            {(id) => <Input id={id} type="date" {...bind('postedOn')} />}
          </Field>
          <Field label="Applied">
            {(id) => <Input id={id} type="date" {...bind('appliedOn')} />}
          </Field>
          <Field label="Deadline">
            {(id) => <Input id={id} type="date" {...bind('deadlineOn')} />}
          </Field>
          <Field label="Follow up">
            {(id) => <Input id={id} type="date" {...bind('followUpOn')} />}
          </Field>
        </div>
        <Field label="Tags" hint="Separate tags with commas." className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="frontend, dream company" {...bind('tags')} />}
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Name">
          {(id) => (
            <Input id={id} placeholder="Recruiter or hiring manager" {...bind('contactName')} />
          )}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} type="email" {...bind('contactEmail')} />}
        </Field>
      </Section>

      <Card>
        <CardHeader
          title="Description"
          description="Markdown is supported."
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon={
                previewDescription ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />
              }
              onClick={() => setPreviewDescription((preview) => !preview)}
            >
              {previewDescription ? 'Edit' : 'Preview'}
            </Button>
          }
        />
        <div className="p-5">
          {previewDescription ? (
            <Markdown>{values.description || '_Nothing to preview._'}</Markdown>
          ) : (
            <Textarea
              aria-label="Description"
              rows={14}
              className="font-mono text-[13px]"
              {...bind('description')}
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" description="Private notes, only visible to you." />
        <div className="p-5">
          <Textarea aria-label="Notes" rows={5} {...bind('notes')} />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}
