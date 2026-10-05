import {
  Binoculars,
  CircleCheck,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useHuntSummaries, useHunts, useUpdateHunt, useViewedHunt } from '../api/hooks';
import type { HuntSummary, JobHunt } from '../api/types';
import { HuntDialogs, type HuntDialog } from '../components/HuntDialogs';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatDate, formatDuration, todayIso } from '../lib/format';

export function HuntsPage() {
  const { data: hunts, isPending, error } = useHunts();
  const { data: summaries } = useHuntSummaries();
  const { hunt: viewed, active, view } = useViewedHunt();
  const reopen = useUpdateHunt();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<HuntDialog>(null);

  if (isPending) return <PageSpinner />;
  if (error) return <Alert>{errorText(error)}</Alert>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Job hunts"
        description="Each hunt has its own jobs, board, charts and stats. Finish one when your search is over and start another for the next."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setDialog({ mode: 'start' })}
          >
            Start a new hunt
          </Button>
        }
      />
      {reopen.isError && <Alert className="mb-4">{errorText(reopen.error)}</Alert>}

      {hunts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Binoculars className="size-6" />}
            title="No job hunt yet"
            description="Your first hunt starts when you add your first job, or you can start one here."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {hunts.map((hunt) => (
            <li key={hunt.id}>
              <HuntCard
                hunt={hunt}
                summary={summaries?.find((summary) => summary.huntId === hunt.id)}
                viewing={hunt.id === viewed?.id}
                canReopen={!active}
                reopening={reopen.isPending && reopen.variables.id === hunt.id}
                onView={() => {
                  view(hunt.id);
                  void navigate('/');
                }}
                onReopen={() => reopen.mutate({ id: hunt.id, changes: { endedOn: null } })}
                onDialog={(mode) => setDialog({ mode, hunt })}
              />
            </li>
          ))}
        </ul>
      )}

      <HuntDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function HuntCard({
  hunt,
  summary,
  viewing,
  canReopen,
  reopening,
  onView,
  onReopen,
  onDialog,
}: {
  hunt: JobHunt;
  summary: HuntSummary | undefined;
  viewing: boolean;
  canReopen: boolean;
  reopening: boolean;
  onView: () => void;
  onReopen: () => void;
  onDialog: (mode: 'edit' | 'finish' | 'delete') => void;
}) {
  const finished = hunt.endedOn !== null;

  return (
    <Card className={cn(viewing && 'ring-2 ring-indigo-400 dark:ring-indigo-600')}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{hunt.name}</h2>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                finished
                  ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
              )}
            >
              {finished ? 'Finished' : 'Active'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {formatDate(hunt.startedOn)} – {finished ? formatDate(hunt.endedOn) : 'now'} ·{' '}
            {formatDuration(hunt.startedOn, hunt.endedOn ?? todayIso())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" icon={<Eye className="size-3.5" />} onClick={onView}>
            {viewing ? 'Open' : 'View'}
          </Button>
          {finished ? (
            canReopen && (
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="size-3.5" />}
                loading={reopening}
                onClick={onReopen}
              >
                Reopen
              </Button>
            )
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={<CircleCheck className="size-3.5" />}
              onClick={() => onDialog('finish')}
            >
              Finish
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            title="Edit"
            aria-label={`Edit ${hunt.name}`}
            icon={<Pencil className="size-3.5" />}
            onClick={() => onDialog('edit')}
          />
          <Button
            size="sm"
            variant="ghost"
            title="Delete"
            aria-label={`Delete ${hunt.name}`}
            icon={<Trash2 className="size-3.5" />}
            onClick={() => onDialog('delete')}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-5">
        <Figure label="Jobs" value={summary?.jobs ?? hunt.jobCount} />
        <Figure label="Applied" value={summary?.applied} />
        <Figure
          label="Response rate"
          value={
            summary &&
            (summary.responseRate === null ? '–' : `${Math.round(summary.responseRate * 100)}%`)
          }
        />
        <Figure label="Interviews" value={summary?.interviews} />
        <Figure label="Offers" value={summary?.offers} />
      </dl>

      {summary?.accepted && (
        <p className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3 text-sm dark:border-zinc-800">
          <Trophy className="size-4 shrink-0 text-amber-500" aria-hidden />
          <span className="min-w-0 truncate">
            Accepted{' '}
            <Link
              to={`/jobs/${summary.accepted.id}`}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {summary.accepted.title}
            </Link>{' '}
            at {summary.accepted.company}
          </span>
        </p>
      )}
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value ?? '–'}</dd>
    </div>
  );
}
