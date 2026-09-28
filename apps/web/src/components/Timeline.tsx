import { CalendarClock, CircleDot, Flag, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAddEvent, useDeleteEvent } from '../api/hooks';
import type { JobEvent, JobEventType, ManualEventType } from '../api/types';
import { formatDateTime } from '../lib/format';
import { EVENT_LABELS } from '../lib/labels';
import { describeEvent } from './EventDescription';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { Alert, errorText } from './ui/feedback';
import { Field, Input, Select, Textarea } from './ui/fields';
import { Modal } from './ui/Modal';

const EVENT_ICONS: Record<JobEventType, typeof CircleDot> = {
  created: CircleDot,
  status_change: CircleDot,
  note: StickyNote,
  interview: CalendarClock,
  follow_up: Flag,
};

const MANUAL_TYPES: ManualEventType[] = ['interview', 'note', 'follow_up'];

/** Local date-time string suitable for <input type="datetime-local">. */
function nowLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function Timeline({ jobId, events }: { jobId: number; events: JobEvent[] }) {
  const [adding, setAdding] = useState(false);
  const deleteEvent = useDeleteEvent(jobId);

  return (
    <Card>
      <CardHeader
        title="Timeline"
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
            Add
          </Button>
        }
      />
      <ol className="px-5 py-4">
        {events.map((event, index) => {
          const Icon = EVENT_ICONS[event.type];
          const upcoming = new Date(event.occurredAt) > new Date();
          return (
            <li key={event.id} className="group relative flex gap-3 pb-5 last:pb-0">
              {index < events.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-6 bottom-0 left-[11px] w-px bg-zinc-200 dark:bg-zinc-800"
                />
              )}
              <div className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Icon className="size-3.5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {describeEvent(event)}
                    {upcoming && (
                      <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Upcoming
                      </span>
                    )}
                  </p>
                  {MANUAL_TYPES.includes(event.type as ManualEventType) && (
                    <button
                      type="button"
                      onClick={() => deleteEvent.mutate(event.id)}
                      className="rounded p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-rose-600 focus:opacity-100"
                      aria-label="Delete event"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {event.type !== 'created' &&
                    event.type !== 'status_change' &&
                    `${EVENT_LABELS[event.type]} · `}
                  {formatDateTime(event.occurredAt)}
                </p>
                {event.body && (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
                    {event.body}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <AddEventModal jobId={jobId} open={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}

function AddEventModal({
  jobId,
  open,
  onClose,
}: {
  jobId: number;
  open: boolean;
  onClose: () => void;
}) {
  const addEvent = useAddEvent(jobId);
  const [type, setType] = useState<ManualEventType>('interview');
  const [title, setTitle] = useState('');
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [body, setBody] = useState('');

  const close = () => {
    addEvent.reset();
    setTitle('');
    setBody('');
    setOccurredAt(nowLocal());
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addEvent.mutate(
      {
        type,
        title: title.trim() || null,
        body: body.trim() || null,
        occurredAt: new Date(occurredAt).toISOString(),
      },
      { onSuccess: close },
    );
  };

  return (
    <Modal open={open} title="Add to timeline" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {addEvent.isError && <Alert>{errorText(addEvent.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select
                id={id}
                value={type}
                onChange={(event) => setType(event.target.value as ManualEventType)}
              >
                {MANUAL_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {EVENT_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="When">
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                required
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              placeholder={type === 'interview' ? 'Technical interview with the team' : 'Optional'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>
        <Field label="Details">
          {(id) => (
            <Textarea
              id={id}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" loading={addEvent.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}
