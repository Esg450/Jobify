import { Download, GanttChart, Waypoints } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTimeline, useViewedHunt } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { Checkbox } from '../components/ui/fields';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { todayIso } from '../lib/format';
import {
  buildGanttRows,
  downloadPng,
  downloadSvg,
  GANTT_THEMES,
  renderGanttSvg,
} from '../lib/gantt';
import { buildSankey, renderSankeySvg } from '../lib/sankey';

type Chart = 'gantt' | 'sankey';

const CHARTS: { id: Chart; label: string; icon: typeof GanttChart; description: string }[] = [
  {
    id: 'gantt',
    label: 'Gantt',
    icon: GanttChart,
    description:
      'Every application as a bar, coloured by status, with interviews marked. Save it as an image to share or print.',
  },
  {
    id: 'sankey',
    label: 'Flow',
    icon: Waypoints,
    description:
      'How your applications moved from one status to the next, and where they ended up. Band width is the number of jobs.',
  },
];

export function TimelinePage() {
  const [chart, setChart] = useState<Chart>('gantt');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [darkExport, setDarkExport] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  const [exportError, setExportError] = useState<string>();
  const { data: jobs, isPending, error } = useTimeline(includeArchived);

  const { hunt, hunts } = useViewedHunt();
  const endedOn = hunt?.endedOn;

  const theme = GANTT_THEMES[darkExport ? 'dark' : 'light'];
  const svg = useMemo(() => {
    if (!jobs) return '';
    // Open applications in a finished hunt stop at its end instead of running on to today.
    const until = endedOn ? new Date(`${endedOn}T23:59:59`) : undefined;
    return chart === 'gantt'
      ? renderGanttSvg(buildGanttRows(jobs, until), theme, until)
      : renderSankeySvg(buildSankey(jobs), theme);
  }, [jobs, chart, theme, endedOn]);
  const filename = `jobify-${chart === 'gantt' ? 'timeline' : 'flow'}-${todayIso()}`;

  const save = async (format: 'png' | 'svg') => {
    setExportError(undefined);
    try {
      if (format === 'svg') downloadSvg(svg, `${filename}.svg`);
      else await downloadPng(svg, `${filename}.png`);
    } catch (cause) {
      setExportError(errorText(cause));
    }
  };

  return (
    <>
      <PageHeader
        title={hunts.length > 1 && hunt ? `Timeline · ${hunt.name}` : 'Timeline'}
        description={CHARTS.find((option) => option.id === chart)!.description}
        actions={
          <>
            <Button
              icon={<Download className="size-4" />}
              onClick={() => save('png')}
              disabled={!jobs?.length}
            >
              Save PNG
            </Button>
            <Button
              icon={<Download className="size-4" />}
              onClick={() => save('svg')}
              disabled={!jobs?.length}
            >
              Save SVG
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex rounded-lg bg-zinc-100 p-0.5 text-sm dark:bg-zinc-800" role="tablist">
          {CHARTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={chart === id}
              onClick={() => setChart(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium',
                chart === id
                  ? 'bg-white shadow-sm dark:bg-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <Checkbox
          label="Include archived jobs"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />
        <Checkbox
          label="Dark background"
          checked={darkExport}
          onChange={(event) => setDarkExport(event.target.checked)}
        />
      </div>
      {exportError && <Alert className="mb-4">{exportError}</Alert>}

      <Card className="overflow-hidden">
        {isPending ? (
          <PageSpinner />
        ) : error ? (
          <div className="p-5">
            <Alert>{errorText(error)}</Alert>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<GanttChart className="size-6" />}
            title="Nothing to chart yet"
            description="Add a job and it will appear here."
            action={<ButtonLink to="/jobs/new">Add job</ButtonLink>}
          />
        ) : (
          // The SVG is generated by Jobify from job titles and companies, which it escapes.
          <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </Card>
    </>
  );
}
