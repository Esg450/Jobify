import { useState, type FormEvent } from 'react';
import { useCreateHunt, useDeleteHunt, useUpdateHunt, useViewedHunt } from '../api/hooks';
import type { JobHunt } from '../api/types';
import { todayIso } from '../lib/format';
import { Button } from './ui/Button';
import { Alert, errorText } from './ui/feedback';
import { Field, Input } from './ui/fields';
import { Modal } from './ui/Modal';

/** Which hunt dialog is open, if any. */
export type HuntDialog =
  { mode: 'start' } | { mode: 'edit' | 'finish' | 'delete'; hunt: JobHunt } | null;

/** Renders the dialog for starting, editing, finishing or deleting a hunt. */
export function HuntDialogs({ dialog, onClose }: { dialog: HuntDialog; onClose: () => void }) {
  if (!dialog) return null;
  if (dialog.mode === 'start') return <StartHuntModal onClose={onClose} />;
  if (dialog.mode === 'delete') return <DeleteHuntModal hunt={dialog.hunt} onClose={onClose} />;
  return (
    <EditHuntModal hunt={dialog.hunt} finishing={dialog.mode === 'finish'} onClose={onClose} />
  );
}

function StartHuntModal({ onClose }: { onClose: () => void }) {
  const { active } = useViewedHunt();
  const create = useCreateHunt();
  const [name, setName] = useState(
    () =>
      `${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} job hunt`,
  );
  const [startedOn, setStartedOn] = useState(todayIso);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name, startedOn }, { onSuccess: onClose });
  };

  return (
    <Modal open title="Start a new job hunt" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          A new hunt starts with an empty list, board and dashboard.{' '}
          {active
            ? `“${active.name}” will be marked as finished; its jobs and stats stay available under Job hunts.`
            : 'Your earlier hunts stay available under Job hunts.'}
        </p>
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Started on">
          {(id) => (
            <Input
              id={id}
              type="date"
              required
              value={startedOn}
              onChange={(event) => setStartedOn(event.target.value)}
            />
          )}
        </Field>
        {create.isError && <Alert>{errorText(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Start hunt
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditHuntModal({
  hunt,
  finishing,
  onClose,
}: {
  hunt: JobHunt;
  finishing: boolean;
  onClose: () => void;
}) {
  const update = useUpdateHunt();
  const [name, setName] = useState(hunt.name);
  const [startedOn, setStartedOn] = useState(hunt.startedOn);
  const [endedOn, setEndedOn] = useState(hunt.endedOn ?? todayIso());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const changes = finishing ? { endedOn } : { name, startedOn, ...(hunt.endedOn && { endedOn }) };
    update.mutate({ id: hunt.id, changes }, { onSuccess: onClose });
  };

  return (
    <Modal open title={finishing ? `Finish “${hunt.name}”?` : 'Edit job hunt'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {finishing ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Nothing is deleted. The hunt’s jobs, charts and stats stay available under Job hunts,
            and you can start a new hunt whenever you begin searching again.
          </p>
        ) : (
          <>
            <Field label="Name">
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label="Started on">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  required
                  value={startedOn}
                  onChange={(event) => setStartedOn(event.target.value)}
                />
              )}
            </Field>
          </>
        )}
        {(finishing || hunt.endedOn) && (
          <Field label="Finished on">
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                min={finishing ? hunt.startedOn : startedOn}
                value={endedOn}
                onChange={(event) => setEndedOn(event.target.value)}
              />
            )}
          </Field>
        )}
        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            {finishing ? 'Finish hunt' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteHuntModal({ hunt, onClose }: { hunt: JobHunt; onClose: () => void }) {
  const remove = useDeleteHunt();
  return (
    <Modal
      open
      title={`Delete “${hunt.name}”?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate(hunt.id, { onSuccess: onClose })}
          >
            Delete hunt
            {hunt.jobCount > 0 && ` and ${hunt.jobCount} ${hunt.jobCount === 1 ? 'job' : 'jobs'}`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {hunt.jobCount > 0
          ? `The hunt, the ${hunt.jobCount === 1 ? 'job' : `${hunt.jobCount} jobs`} in it and their timelines will be removed permanently.`
          : 'This hunt has no jobs in it.'}{' '}
        {!hunt.endedOn && 'Finish it instead if you only want to start a new search.'}
      </p>
      {remove.isError && <Alert className="mt-3">{errorText(remove.error)}</Alert>}
    </Modal>
  );
}
