import { CalendarClock, CircleDot, Flag, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useAddEvent, useDeleteEvent, useUpdateEvent } from '../api/hooks';
import {
  JOB_STATUSES,
  type JobEvent,
  type JobEventType,
  type JobStatus,
  type ManualEventType,
} from '../api/types';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import { EVENT_LABELS, STATUS_LABELS } from '../lib/labels';
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

function isManual(type: JobEventType): type is ManualEventType {
  return MANUAL_TYPES.includes(type as ManualEventType);
}

/** Local date-time string suitable for <input type="datetime-local">. */
function toLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const ACTION_CLASSES =
  'rounded p-1 text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100';

export function Timeline({ jobId, events }: { jobId: number; events: JobEvent[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<JobEvent | null>(null);
  const [removing, setRemoving] = useState<JobEvent | null>(null);
  const [viewing, setViewing] = useState<JobEvent | null>(null);
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
                  <p className="min-w-0 text-sm font-medium wrap-anywhere">
                    {describeEvent(event)}
                    {upcoming && (
                      <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Upcoming
                      </span>
                    )}
                  </p>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditing(event)}
                      className={`${ACTION_CLASSES} hover:text-zinc-700 dark:hover:text-zinc-200`}
                      aria-label="Edit event"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {event.type !== 'created' && (
                      <button
                        type="button"
                        onClick={() =>
                          event.type === 'status_change'
                            ? setRemoving(event)
                            : deleteEvent.mutate(event.id)
                        }
                        className={`${ACTION_CLASSES} hover:text-rose-600`}
                        aria-label="Delete event"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <EventMeta event={event} />
                {event.body && <EventBody body={event.body} onExpand={() => setViewing(event)} />}
              </div>
            </li>
          );
        })}
      </ol>
      <AddEventModal jobId={jobId} open={adding} onClose={() => setAdding(false)} />
      {editing && <EditEventModal jobId={jobId} event={editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <EventDetailsModal
          event={viewing}
          onEdit={() => {
            setViewing(null);
            setEditing(viewing);
          }}
          onClose={() => setViewing(null)}
        />
      )}
      {removing && (
        <RemoveStepModal
          jobId={jobId}
          event={removing}
          events={events}
          onClose={() => setRemoving(null)}
        />
      )}
    </Card>
  );
}

/** The type (for manual events) and date under an event's title. */
function EventMeta({ event, className }: { event: JobEvent; className?: string }) {
  return (
    <p className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)}>
      {isManual(event.type) && `${EVENT_LABELS[event.type]} · `}
      {formatDateTime(event.occurredAt)}
    </p>
  );
}

/**
 * The details of an event, cut to a few lines so a long note doesn't take over the timeline.
 * When text is hidden, a button opens the full details.
 */
function EventBody({ body, onExpand }: { body: string; onExpand: () => void }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [body]);

  return (
    <>
      <p
        ref={text}
        className="mt-1 line-clamp-3 text-sm break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-300"
      >
        {body}
      </p>
      {clamped && (
        <button
          type="button"
          onClick={onExpand}
          className="mt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Show details
        </button>
      )}
    </>
  );
}

/** Shows one event in full, for details too long for the timeline. */
function EventDetailsModal({
  event,
  onEdit,
  onClose,
}: {
  event: JobEvent;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={describeEvent(event)}
      onClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button icon={<Pencil className="size-3.5" />} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <EventMeta event={event} />
      {event.body && (
        <p className="mt-3 max-h-[60vh] overflow-y-auto text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
          {event.body}
        </p>
      )}
    </Modal>
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
  const [occurredAt, setOccurredAt] = useState(() => toLocal(new Date()));
  const [body, setBody] = useState('');

  const close = () => {
    addEvent.reset();
    setTitle('');
    setBody('');
    setOccurredAt(toLocal(new Date()));
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
          <WhenField value={occurredAt} onChange={setOccurredAt} />
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

/**
 * Edits one event. A manual event is fully editable; a status step can change where it moved
 * the job to and when; the created event only when.
 */
function EditEventModal({
  jobId,
  event,
  onClose,
}: {
  jobId: number;
  event: JobEvent;
  onClose: () => void;
}) {
  const updateEvent = useUpdateEvent(jobId);
  const manual = isManual(event.type);
  const [type, setType] = useState<ManualEventType>(isManual(event.type) ? event.type : 'note');
  const [title, setTitle] = useState(event.title ?? '');
  const [body, setBody] = useState(event.body ?? '');
  const [occurredAt, setOccurredAt] = useState(() => toLocal(new Date(event.occurredAt)));
  const [toStatus, setToStatus] = useState<JobStatus>(event.toStatus ?? 'saved');

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    updateEvent.mutate(
      {
        eventId: event.id,
        occurredAt: new Date(occurredAt).toISOString(),
        ...(manual && { type, title: title.trim() || null, body: body.trim() || null }),
        ...(event.type === 'status_change' && { toStatus }),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal open title={manual ? 'Edit event' : 'Edit step'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {updateEvent.isError && <Alert>{errorText(updateEvent.error)}</Alert>}
        {event.type === 'status_change' && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Changing where this step goes also updates the step after it and, if this is the latest
            step, the job's status.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {manual && (
            <Field label="Type">
              {(id) => (
                <Select
                  id={id}
                  value={type}
                  onChange={(changeEvent) => setType(changeEvent.target.value as ManualEventType)}
                >
                  {MANUAL_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {EVENT_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {event.type === 'status_change' && (
            <Field label="Moved to">
              {(id) => (
                <Select
                  id={id}
                  value={toStatus}
                  onChange={(changeEvent) => setToStatus(changeEvent.target.value as JobStatus)}
                >
                  {JOB_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <WhenField value={occurredAt} onChange={setOccurredAt} />
        </div>
        {manual && (
          <>
            <Field label="Title">
              {(id) => (
                <Input
                  id={id}
                  value={title}
                  onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                />
              )}
            </Field>
            <Field label="Details">
              {(id) => (
                <Textarea
                  id={id}
                  rows={4}
                  value={body}
                  onChange={(changeEvent) => setBody(changeEvent.target.value)}
                />
              )}
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={updateEvent.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Confirms removing a status step, since that rewrites the history and may change the job's status. */
function RemoveStepModal({
  jobId,
  event,
  events,
  onClose,
}: {
  jobId: number;
  event: JobEvent;
  events: JobEvent[];
  onClose: () => void;
}) {
  const deleteEvent = useDeleteEvent(jobId);
  // Events arrive newest first, so the latest step is the first status change in the list.
  const latest = events.find((candidate) => candidate.type === 'status_change')?.id === event.id;
  const previous = event.fromStatus ? STATUS_LABELS[event.fromStatus] : null;

  return (
    <Modal
      open
      title="Remove this step?"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteEvent.isPending}
            onClick={() => deleteEvent.mutate(event.id, { onSuccess: onClose })}
          >
            Remove
          </Button>
        </>
      }
    >
      {deleteEvent.isError && <Alert className="mb-3">{errorText(deleteEvent.error)}</Alert>}
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        “{describeEvent(event)}” will be taken out of the history.{' '}
        {latest
          ? previous
            ? `The job goes back to ${previous.toLowerCase()}.`
            : 'The job goes back to its previous status.'
          : previous
            ? `The next step will start from ${previous.toLowerCase()} instead.`
            : 'The next step will start from where this one did.'}
      </p>
    </Modal>
  );
}

function WhenField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="When">
      {(id) => (
        <Input
          id={id}
          type="datetime-local"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
