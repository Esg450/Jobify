import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAiSettings, useCurrentUser, useRunAiTask } from '../api/hooks';
import type { AiTask, Job } from '../api/types';
import { AI_TASK_LABELS } from '../lib/labels';
import { Markdown } from './Markdown';
import { Button } from './ui/Button';
import { Alert, EmptyState, errorText } from './ui/feedback';

const OUTPUT_TASKS: { task: Exclude<AiTask, 'description'>; field: keyof Job; hint: string }[] = [
  {
    task: 'summary',
    field: 'aiSummary',
    hint: 'Key responsibilities, requirements and anything worth asking about.',
  },
  {
    task: 'cover-letter',
    field: 'coverLetter',
    hint: 'A first draft based on the posting and your profile.',
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
  const [selected, setSelected] = useState<(typeof OUTPUT_TASKS)[number]['task']>('summary');

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

  const current = OUTPUT_TASKS.find(({ task }) => task === selected)!;
  const output = job[current.field] as string | null;
  const running = runTask.isPending && runTask.variables === selected;

  return (
    <div className="flex flex-col gap-4">
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
      </div>

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
