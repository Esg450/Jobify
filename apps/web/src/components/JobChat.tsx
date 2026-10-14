import { MessageSquare, SendHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAskJobChat, useClearJobChat, useJobChat } from '../api/hooks';
import type { ChatMessage, Job } from '../api/types';
import { cn } from '../lib/cn';
import { Markdown } from './Markdown';
import { Button } from './ui/Button';
import { Alert, errorText } from './ui/feedback';
import { Textarea } from './ui/fields';
import { Spinner } from './ui/Spinner';

const STARTERS = [
  'Why do I want to work here?',
  'How well does my background fit this role?',
  'What gaps should I address in my application?',
  'What questions should I expect in a first interview?',
];

/** A conversation with the AI about one job. The transcript lives on the server. */
export function JobChat({ job }: { job: Job }) {
  const { data: messages = [], isPending: loading, error: loadError } = useJobChat(job.id);
  const ask = useAskJobChat(job.id);
  const clear = useClearJobChat(job.id);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const disabled = !job.description || ask.isPending;
  const pendingQuestion = ask.isPending ? ask.variables : undefined;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, pendingQuestion]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || disabled) return;
    setDraft('');
    ask.mutate(message);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  // Enter sends, Shift+Enter adds a line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  if (loading) return <Spinner className="mx-auto my-8" />;

  return (
    <div className="flex flex-col gap-4">
      {loadError && <Alert>{errorText(loadError)}</Alert>}

      {messages.length === 0 && !pendingQuestion ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
          <MessageSquare className="mx-auto mb-3 size-6 text-zinc-400" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask anything about this posting. The AI knows the description and your profile.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((starter) => (
              <Button key={starter} size="sm" disabled={disabled} onClick={() => send(starter)}>
                {starter}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {pendingQuestion && (
            <>
              <Bubble message={{ role: 'user', content: pendingQuestion }} />
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner className="size-4" />
                Thinking…
              </div>
            </>
          )}
          <div ref={bottom} />
        </div>
      )}

      {ask.isError && <Alert>{errorText(ask.error)}</Alert>}
      {clear.isError && <Alert>{errorText(clear.error)}</Alert>}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            job.description
              ? 'Ask a question or request a draft… (Enter to send)'
              : 'Add a job description first'
          }
          disabled={!job.description}
          rows={2}
          className="min-h-0"
          aria-label="Message"
        />
        <div className="flex items-center justify-between gap-2">
          {messages.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3.5" />}
              loading={clear.isPending}
              disabled={ask.isPending}
              onClick={() => clear.mutate()}
            >
              Clear conversation
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            variant="primary"
            icon={<SendHorizontal className="size-4" />}
            loading={ask.isPending}
            disabled={disabled || !draft.trim()}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: Pick<ChatMessage, 'role' | 'content'> }) {
  const mine = message.role === 'user';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
          mine
            ? 'rounded-br-md bg-indigo-600 text-white'
            : 'rounded-bl-md bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
        )}
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}
      </div>
    </div>
  );
}
