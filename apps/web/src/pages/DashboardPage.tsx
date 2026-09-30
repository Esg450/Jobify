import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Flag,
  GripVertical,
  History,
  MessagesSquare,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { usePreferences, useStats, useUpdatePreferences } from '../api/hooks';
import {
  DASHBOARD_CARDS,
  JOB_STATUSES,
  type DashboardCard,
  type DashboardLayout,
  type Stats,
} from '../api/types';
import { describeEvent } from '../components/EventDescription';
import { PageHeader } from '../components/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatDate, formatDateTime, formatRelative } from '../lib/format';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/labels';

/** What each dashboard card shows. `wide` cards take half a row; the others a quarter. */
const CARDS: Record<
  DashboardCard,
  { title: string; wide?: boolean; render: (stats: Stats) => ReactNode }
> = {
  active: {
    title: 'Active',
    render: (stats) => (
      <StatTile
        icon={<BriefcaseBusiness />}
        label="Active"
        value={stats.active}
        hint={`${stats.total} tracked`}
      />
    ),
  },
  applied: {
    title: 'Applied',
    render: (stats) => (
      <StatTile icon={<Send />} label="Applied" value={stats.applied} hint="Applications sent" />
    ),
  },
  response_rate: {
    title: 'Response rate',
    render: (stats) => (
      <StatTile
        icon={<MessagesSquare />}
        label="Response rate"
        value={stats.responseRate === null ? '–' : `${Math.round(stats.responseRate * 100)}%`}
        hint={`${stats.byStatus.screening + stats.byStatus.interviewing} in progress`}
      />
    ),
  },
  offers: {
    title: 'Offers',
    render: (stats) => (
      <StatTile
        icon={<Trophy />}
        label="Offers"
        value={stats.byStatus.offer + stats.byStatus.accepted}
        hint={`${stats.byStatus.accepted} accepted`}
      />
    ),
  },
  pipeline: {
    title: 'Pipeline',
    wide: true,
    render: (stats) => (
      <Card className="h-full">
        <CardHeader title="Pipeline" description="Where your non-archived jobs stand." />
        <div className="p-5">
          <Pipeline stats={stats} />
        </div>
      </Card>
    ),
  },
  weekly: {
    title: 'Applications per week',
    wide: true,
    render: (stats) => (
      <Card className="h-full">
        <CardHeader title="Applications per week" description="Last 12 weeks" />
        <div className="p-5">
          <WeeklyChart weekly={stats.weekly} />
        </div>
      </Card>
    ),
  },
  upcoming: {
    title: 'Coming up',
    wide: true,
    render: (stats) => (
      <Card className="h-full">
        <CardHeader title="Coming up" description="Interviews, follow-ups and deadlines." />
        <UpcomingList upcoming={stats.upcoming} />
      </Card>
    ),
  },
  activity: {
    title: 'Recent activity',
    wide: true,
    render: (stats) => (
      <Card className="h-full">
        <CardHeader title="Recent activity" />
        <ActivityList activity={stats.recentActivity} />
      </Card>
    ),
  },
};

const DEFAULT_LAYOUT: DashboardLayout = { order: [...DASHBOARD_CARDS], hidden: [] };

function isDefault(layout: DashboardLayout): boolean {
  return (
    layout.hidden.length === 0 &&
    layout.order.every((card, index) => card === DASHBOARD_CARDS[index])
  );
}

export function DashboardPage() {
  const { data: stats, isPending, error } = useStats();
  const preferences = usePreferences();
  const save = useUpdatePreferences();
  const [editing, setEditing] = useState(false);

  if (isPending || preferences.isPending) return <PageSpinner />;
  if (error) return <Alert>{errorText(error)}</Alert>;

  if (stats.total === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BriefcaseBusiness className="size-6" />}
          title="Welcome to Jobify"
          description="Track every application in one place. Add a job by hand, or paste a link from LinkedIn, Workday, Greenhouse, Lever and more to import it."
          action={
            <ButtonLink to="/jobs/new" variant="primary" icon={<Plus className="size-4" />}>
              Add your first job
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  // If the preferences failed to load, show the default layout rather than nothing.
  const layout = preferences.data?.dashboard ?? DEFAULT_LAYOUT;
  const update = (dashboard: DashboardLayout) => save.mutate({ dashboard });
  const hide = (card: DashboardCard) => update({ ...layout, hidden: [...layout.hidden, card] });
  const show = (card: DashboardCard) =>
    update({ ...layout, hidden: layout.hidden.filter((hidden) => hidden !== card) });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your job search."
        actions={
          editing ? (
            <>
              <Button
                variant="ghost"
                icon={<RotateCcw className="size-4" />}
                onClick={() => update(DEFAULT_LAYOUT)}
                disabled={isDefault(layout)}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                icon={<Check className="size-4" />}
                onClick={() => setEditing(false)}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                icon={<SlidersHorizontal className="size-4" />}
                onClick={() => setEditing(true)}
              >
                Customize
              </Button>
              <ButtonLink to="/jobs/new" variant="primary" icon={<Plus className="size-4" />}>
                Add job
              </ButtonLink>
            </>
          )
        }
      />

      {editing && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Drag cards to reorder them.</span>
          {layout.hidden.length > 0 && <span className="ml-2">Hidden:</span>}
          {layout.hidden.map((card) => (
            <button
              key={card}
              type="button"
              onClick={() => show(card)}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Eye className="size-3.5" aria-hidden />
              {CARDS[card].title}
            </button>
          ))}
        </div>
      )}

      <CardGrid layout={layout} editing={editing} onReorder={update}>
        {(card) => (
          <EditableCard card={card} editing={editing} onHide={() => hide(card)}>
            {CARDS[card].render(stats)}
          </EditableCard>
        )}
      </CardGrid>
    </>
  );
}

/** The visible cards in a sortable grid. Hidden cards keep their slot in the stored order. */
function CardGrid({
  layout,
  editing,
  onReorder,
  children,
}: {
  layout: DashboardLayout;
  editing: boolean;
  onReorder: (layout: DashboardLayout) => void;
  children: (card: DashboardCard) => ReactNode;
}) {
  const visible = layout.order.filter((card) => !layout.hidden.includes(card));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const moved = arrayMove(
      visible,
      visible.indexOf(active.id as DashboardCard),
      visible.indexOf(over.id as DashboardCard),
    );
    let next = 0;
    onReorder({
      ...layout,
      order: layout.order.map((card) => (layout.hidden.includes(card) ? card : moved[next++])),
    });
  };

  const grid = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visible.map((card) => (
        <div key={card} className={cn(CARDS[card].wide && 'sm:col-span-2')}>
          {children(card)}
        </div>
      ))}
    </div>
  );
  if (!editing) return grid;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visible} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}

/** Adds the drag handle and hide button to a card while the dashboard is being customised. */
function EditableCard({
  card,
  editing,
  onHide,
  children,
}: {
  card: DashboardCard;
  editing: boolean;
  onHide: () => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card, disabled: !editing });

  if (!editing) return <div className="h-full">{children}</div>;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative h-full rounded-xl ring-2 ring-indigo-300 ring-offset-2 ring-offset-white dark:ring-indigo-700 dark:ring-offset-zinc-950',
        isDragging && 'z-10 opacity-80 shadow-xl',
      )}
    >
      <div className="pointer-events-none h-full select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-white/90 p-0.5 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/90 dark:ring-zinc-700">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="cursor-grab rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={`Move ${CARDS[card].title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onHide}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={`Hide ${CARDS[card].title}`}
        >
          <EyeOff className="size-4" />
        </button>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <Card className="flex h-full items-start gap-4 p-5">
      <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 [&>svg]:size-5">
        {icon}
      </div>
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
    </Card>
  );
}

function Pipeline({ stats }: { stats: Stats }) {
  const statuses = JOB_STATUSES.filter((status) => stats.byStatus[status] > 0);
  return (
    <>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {statuses.map((status) => (
          <div
            key={status}
            className={STATUS_STYLES[status].dot}
            style={{ width: `${(stats.byStatus[status] / stats.total) * 100}%` }}
            title={`${STATUS_LABELS[status]}: ${stats.byStatus[status]}`}
          />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {JOB_STATUSES.map((status) => (
          <li key={status}>
            <Link
              to={`/jobs?status=${status}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <span
                  aria-hidden
                  className={cn('size-2 rounded-full', STATUS_STYLES[status].dot)}
                />
                {STATUS_LABELS[status]}
              </span>
              <span className="font-medium tabular-nums">{stats.byStatus[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function WeeklyChart({ weekly }: { weekly: Stats['weekly'] }) {
  const max = Math.max(1, ...weekly.map((week) => week.count));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Applications per week">
        {weekly.map(({ week, count }) => (
          <div key={week} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn(
                'w-full rounded-t-sm transition-colors',
                count ? 'bg-indigo-500 group-hover:bg-indigo-400' : 'bg-zinc-200 dark:bg-zinc-800',
              )}
              style={{ height: count ? `${(count / max) * 100}%` : '3px' }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block dark:bg-zinc-700">
              {count} · week of {formatDate(week, { year: undefined })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{formatDate(weekly[0]?.week, { year: undefined })}</span>
        <span>This week</span>
      </div>
    </div>
  );
}

const UPCOMING_ICONS = { interview: CalendarClock, follow_up: Flag, deadline: CalendarDays };
const UPCOMING_LABELS = { interview: 'Interview', follow_up: 'Follow up', deadline: 'Deadline' };

function UpcomingList({ upcoming }: { upcoming: Stats['upcoming'] }) {
  if (upcoming.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Nothing scheduled.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {upcoming.map((item, index) => {
        const Icon = UPCOMING_ICONS[item.type];
        const overdue =
          item.type === 'follow_up' && new Date(item.date) < new Date(new Date().toDateString());
        return (
          <li key={`${item.type}-${item.job.id}-${index}`}>
            <Link
              to={`/jobs/${item.job.id}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            >
              <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.label ?? UPCOMING_LABELS[item.type]} · {item.job.company}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {item.job.title}
                </p>
              </div>
              <span
                className={cn(
                  'text-xs whitespace-nowrap',
                  overdue ? 'font-medium text-rose-600' : 'text-zinc-500',
                )}
              >
                {item.type === 'interview' ? formatDateTime(item.date) : formatDate(item.date)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityList({ activity }: { activity: Stats['recentActivity'] }) {
  if (activity.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No activity yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {activity.map((event) => (
        <li key={event.id}>
          <Link
            to={`/jobs/${event.job.id}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          >
            <History className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{event.job.company}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> · {describeEvent(event)}</span>
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{event.job.title}</p>
            </div>
            <span className="text-xs whitespace-nowrap text-zinc-500">
              {formatRelative(event.occurredAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
