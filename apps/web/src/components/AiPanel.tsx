import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  useAiSettings,
  useCurrentUser,
  useProfile,
  useRunAiTask,
  useUpdateJob,
} from '../api/hooks';
import type { AiTask, Job, Profile } from '../api/types';
import { cn } from '../lib/cn';
import { AI_TASK_LABELS } from '../lib/labels';
import { JobChat } from './JobChat';
import { Markdown } from './Markdown';
import { ResumeField } from './ResumeField';
import { Button } from './ui/Button';
import { Alert, EmptyState, errorText } from './ui/feedback';
import { Field, Input, Textarea } from './ui/fields';

const OUTPUT_TASKS: { task: Exclude<AiTask, 'description'>; field: keyof Job; hint: string }[] = [
  {
    task: 'summary',
    field: 'aiSummary',
    hint: 'Key responsibilities, requirements and anything worth asking about.',
  },
  {
    task: 'cover-letter',
    field: 'coverLetter',
    hint: 'A first draft based on the posting and your resume.',
  },
  {
    task: 'interview-prep',
    field: 'interviewPrep',
    hint: 'Likely questions, questions to ask and topics to review.',
  },
];

export function AiPanel({ job }: { job: Job }) {
  const { data: settings, isPending } = useAiSettings();
  const isAdmin = useCurrentUser().role === 'admin';
  const runTask = useRunAiTask(job.id);
  const [selected, setSelected] = useState<(typeof OUTPUT_TASKS)[number]['task'] | 'chat'>(
    'summary',
  );

  if (isPending) return null;
  if (!settings?.configured) {
    return (
      <EmptyState
        icon={<Sparkles className="size-6" />}
        title="Set up an AI provider"
        description={
          isAdmin
            ? 'Connect Anthropic, OpenAI, Gemini, Ollama or any OpenAI-compatible API to generate summaries, cover letters and interview prep.'
            : 'AI features are not set up yet. Ask an admin to connect an AI provider.'
        }
        action={
          isAdmin && (
            <Link
              to="/settings/ai"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Open settings
            </Link>
          )
        }
      />
    );
  }

  const tabs = (
    <>
      <div className="flex flex-wrap gap-2">
        {OUTPUT_TASKS.map(({ task, field }) => (
          <Button
            key={task}
            size="sm"
            variant={selected === task ? 'primary' : 'secondary'}
            onClick={() => setSelected(task)}
          >
            {AI_TASK_LABELS[task].title}
            {job[field] && <Check className="size-3.5" aria-label="generated" />}
          </Button>
        ))}
        <Button
          size="sm"
          variant={selected === 'chat' ? 'primary' : 'secondary'}
          icon={<MessageSquare className="size-3.5" />}
          onClick={() => setSelected('chat')}
        >
          Ask
        </Button>
      </div>
      <JobProfileSection job={job} />
    </>
  );

  if (selected === 'chat') {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        {!job.description && (
          <Alert>Add a job description first; the AI works from the posting.</Alert>
        )}
        <JobChat job={job} />
      </div>
    );
  }

  const current = OUTPUT_TASKS.find(({ task }) => task === selected)!;
  const output = job[current.field] as string | null;
  const running = runTask.isPending && runTask.variables === selected;

  return (
    <div className="flex flex-col gap-4">
      {tabs}

      {!job.description && (
        <Alert>Add a job description first; the AI works from the posting.</Alert>
      )}
      {runTask.isError && <Alert>{errorText(runTask.error)}</Alert>}

      {output ? (
        <>
          <div className="flex justify-end gap-2">
            <CopyButton text={output} />
            <Button
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              loading={running}
              disabled={runTask.isPending}
              onClick={() => runTask.mutate(selected)}
            >
              Regenerate
            </Button>
          </div>
          <Markdown>{output}</Markdown>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.hint}</p>
          <Button
            className="mt-4"
            variant="primary"
            icon={<Sparkles className="size-4" />}
            loading={running}
            disabled={!job.description || runTask.isPending}
            onClick={() => runTask.mutate(selected)}
          >
            {AI_TASK_LABELS[selected].action}
          </Button>
        </div>
      )}
    </div>
  );
}

const PROFILE_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: 'name', label: 'name' },
  { key: 'headline', label: 'headline' },
  { key: 'preferences', label: 'preferences' },
  { key: 'resume', label: 'resume' },
];

const EMPTY_PROFILE: Profile = { name: '', headline: '', preferences: '', resume: '' };

/** The job's own details with blanks (and anything that is not text) normalized to ''. */
function jobProfile(job: Job): Profile {
  const result = { ...EMPTY_PROFILE };
  for (const { key } of PROFILE_FIELDS) {
    const value = job.profile?.[key];
    if (typeof value === 'string') result[key] = value.trim();
  }
  return result;
}

/** The fields the job fills in itself. */
function overriddenFields(job: Job): (keyof Profile)[] {
  const own = jobProfile(job);
  return PROFILE_FIELDS.filter(({ key }) => own[key]).map(({ key }) => key);
}

function listFields(keys: (keyof Profile)[]): string {
  const labels = keys.map((key) => PROFILE_FIELDS.find((field) => field.key === key)!.label);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
    : (labels[0] ?? '');
}

/**
 * Who the AI thinks the candidate is on this page. The profile is the default; any field saved
 * here replaces the same field of the profile for this job's summary, cover letter, interview
 * prep and chat, which is how someone who applies with several resumes keeps each job on the
 * right one. Blank fields fall back to the profile.
 */
function JobProfileSection({ job }: { job: Job }) {
  const { data: profile } = useProfile();
  const updateJob = useUpdateJob();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);

  // The row says whether the AI knows the candidate, so it waits for the profile to load
  // rather than flashing the warning.
  if (!profile) return null;

  const overridden = overriddenFields(job);
  const hasProfile = PROFILE_FIELDS.some(({ key }) => profile[key]?.trim());
  const known = hasProfile || overridden.length > 0;

  const save = (changes: Partial<Profile> | null) =>
    updateJob.mutate(
      { id: job.id, changes: { profile: changes } },
      { onSuccess: () => setEditing(false) },
    );

  const open = () => {
    updateJob.reset();
    setDraft(jobProfile(job));
    setEditing(true);
  };

  if (!editing) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-3 py-1.5 text-sm',
          known
            ? 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300'
            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        )}
      >
        <span className="flex items-center gap-2">
          {known ? (
            <FileText className="size-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          )}
          {!known ? (
            <span>
              The AI knows nothing about you yet, so it cannot tailor anything. Fill in{' '}
              <Link to="/settings/account" className="font-medium underline">
                your profile
              </Link>{' '}
              or add details for this job.
            </span>
          ) : overridden.length === 0 ? (
            'Using your profile.'
          ) : hasProfile ? (
            `Using the ${listFields(overridden)} saved for this job; the rest comes from your profile.`
          ) : (
            `Using the ${listFields(overridden)} saved for this job.`
          )}
        </span>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={open}>
            {overridden.length > 0
              ? 'Edit'
              : known
                ? 'Use different details'
                : 'Add details for this job'}
          </Button>
          {overridden.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              loading={updateJob.isPending}
              onClick={() => save(null)}
            >
              Use profile only
            </Button>
          )}
        </div>
        {updateJob.isError && <Alert className="w-full">{errorText(updateJob.error)}</Alert>}
      </div>
    );
  }

  const bind = (key: 'name' | 'headline' | 'preferences') => ({
    value: draft[key],
    placeholder: profile[key] ? `From your profile: ${profile[key]}` : undefined,
    onChange: (event: { target: { value: string } }) =>
      setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h3 className="text-sm font-semibold">Details for this job</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Anything you fill in here replaces the same field of your profile for this job only. Blank
          fields use your profile. Regenerate anything already written to pick it up.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} {...bind('name')} />}</Field>
        <Field label="Headline">{(id) => <Input id={id} {...bind('headline')} />}</Field>
      </div>
      <Field label="What you're looking for">
        {(id) => <Textarea id={id} rows={2} {...bind('preferences')} />}
      </Field>
      <ResumeField
        label="Resume"
        hint={
          profile.resume
            ? 'Leave this blank to use the resume on your profile.'
            : 'Your profile has no resume yet, so this is the only one the AI will see for this job. PDF, Word document (.docx) or plain text.'
        }
        placeholder="Paste the resume you are sending for this job, or drop a file."

        rows={8}
        value={draft.resume}
        onChange={(resume) => setDraft((current) => ({ ...current, resume }))}
      />
      {updateJob.isError && <Alert>{errorText(updateJob.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={updateJob.isPending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={updateJob.isPending}
          onClick={() => {
            // Only filled fields are kept, so the saved object says exactly what is overridden.
            const filled = Object.fromEntries(
              PROFILE_FIELDS.flatMap(({ key }) => {
                const value = draft[key].trim();
                return value ? [[key, value]] : [];
              }),
            ) as Partial<Profile>;
            save(Object.keys(filled).length ? filled : null);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // The clipboard API is only available on HTTPS or localhost.
  if (!navigator.clipboard) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      onClick={copy}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
