import { JOB_STATUSES, type JobStatus, type TimelineJob } from '../api/types';
import { GANTT_COLORS, type GanttTheme } from './gantt';
import { STATUS_LABELS } from './labels';

/** Where each status sits left to right. Outcomes share the last column. */
const COLUMN: Record<JobStatus, number> = {
  saved: 0,
  applied: 1,
  screening: 2,
  interviewing: 3,
  offer: 4,
  accepted: 5,
  rejected: 5,
  withdrawn: 5,
  ghosted: 5,
};

export interface SankeyNode {
  status: JobStatus;
  /** Jobs that passed through or ended at this status. */
  value: number;
  /** Jobs whose last known status this is. */
  current: number;
}

export interface SankeyLink {
  source: JobStatus;
  target: JobStatus;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/** The statuses a job went through, oldest first, without repeats. */
function statusPath(job: TimelineJob): JobStatus[] {
  const created = job.events.find((event) => event.type === 'created');
  const changes = job.events.filter((event) => event.type === 'status_change' && event.toStatus);
  const path: JobStatus[] = [created?.toStatus ?? changes[0]?.fromStatus ?? job.status];
  for (const change of changes) path.push(change.toStatus!);
  if (path[path.length - 1] !== job.status) path.push(job.status);
  return path.filter((status, index) => index === 0 || status !== path[index - 1]);
}

/** Counts how many applications moved between each pair of statuses. */
export function buildSankey(jobs: TimelineJob[]): SankeyData {
  const starts = new Map<JobStatus, number>();
  const ends = new Map<JobStatus, number>();
  const inflow = new Map<JobStatus, number>();
  const links = new Map<string, SankeyLink>();

  for (const job of jobs) {
    const path = statusPath(job);
    starts.set(path[0], (starts.get(path[0]) ?? 0) + 1);
    ends.set(path[path.length - 1], (ends.get(path[path.length - 1]) ?? 0) + 1);
    for (let index = 1; index < path.length; index++) {
      const [source, target] = [path[index - 1], path[index]];
      const key = `${source}→${target}`;
      const link = links.get(key) ?? { source, target, value: 0 };
      link.value++;
      links.set(key, link);
      inflow.set(target, (inflow.get(target) ?? 0) + 1);
    }
  }

  const nodes = JOB_STATUSES.map((status) => ({
    status,
    value: (starts.get(status) ?? 0) + (inflow.get(status) ?? 0),
    current: ends.get(status) ?? 0,
  })).filter((node) => node.value > 0);

  return { nodes, links: [...links.values()] };
}

const WIDTH = 960;
const HEIGHT = 480;
const PADDING = 20;
const LABEL_SPACE = 150;
const NODE_WIDTH = 18;
const NODE_GAP = 16;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

interface PlacedNode extends SankeyNode {
  x: number;
  y: number;
  height: number;
  outY: number;
  inY: number;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Renders the flow as a self-contained SVG document. */
export function renderSankeySvg(data: SankeyData, theme: GanttTheme): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT}" font-size="12">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.background}"/>`,
  ];
  if (data.nodes.length === 0) return `${parts.join('')}</svg>`;

  // Only columns that have nodes take up space.
  const columns = [...new Set(data.nodes.map((node) => COLUMN[node.status]))].sort((a, b) => a - b);
  const columnIndex = new Map(columns.map((column, index) => [column, index]));
  // Labels sit to the right of their node, so only the last column needs room for one.
  const plotLeft = PADDING + 8;
  const plotRight = WIDTH - PADDING - LABEL_SPACE;
  const columnX = (status: JobStatus) =>
    columns.length === 1
      ? (plotLeft + plotRight - NODE_WIDTH) / 2
      : plotLeft +
        (columnIndex.get(COLUMN[status])! * (plotRight - plotLeft - NODE_WIDTH)) /
          (columns.length - 1);

  const byColumn = new Map<number, SankeyNode[]>();
  for (const node of data.nodes) {
    const list = byColumn.get(COLUMN[node.status]) ?? [];
    list.push(node);
    byColumn.set(COLUMN[node.status], list);
  }
  const plotHeight = HEIGHT - PADDING * 2 - 24;
  const scale = Math.min(
    ...[...byColumn.values()].map(
      (list) =>
        (plotHeight - NODE_GAP * (list.length - 1)) /
        list.reduce((sum, node) => sum + node.value, 0),
    ),
  );

  const placed = new Map<JobStatus, PlacedNode>();
  for (const list of byColumn.values()) {
    const total =
      list.reduce((sum, node) => sum + node.value * scale, 0) + NODE_GAP * (list.length - 1);
    let y = PADDING + 24 + (plotHeight - total) / 2;
    for (const node of list) {
      const height = node.value * scale;
      placed.set(node.status, { ...node, x: columnX(node.status), y, height, outY: y, inY: y });
      y += height + NODE_GAP;
    }
  }

  // Bands leave a node in the order of where they go and arrive in the order of where they
  // came from, which keeps them from crossing needlessly. Links are drawn before nodes.
  const links = [...data.links].sort(
    (a, b) =>
      placed.get(a.source)!.y - placed.get(b.source)!.y ||
      placed.get(a.target)!.y - placed.get(b.target)!.y,
  );
  const startY = new Map<SankeyLink, number>();
  for (const link of links) {
    const source = placed.get(link.source)!;
    startY.set(link, source.outY);
    source.outY += link.value * scale;
  }
  const endY = new Map<SankeyLink, number>();
  for (const link of [...links].sort((a, b) => placed.get(a.source)!.y - placed.get(b.source)!.y)) {
    const target = placed.get(link.target)!;
    endY.set(link, target.inY);
    target.inY += link.value * scale;
  }
  for (const link of links) {
    const source = placed.get(link.source)!;
    const target = placed.get(link.target)!;
    const width = link.value * scale;
    const x0 = source.x + NODE_WIDTH;
    const x1 = target.x;
    const y0 = startY.get(link)!;
    const y1 = endY.get(link)!;
    const xm = (x0 + x1) / 2;
    parts.push(
      `<path d="M${x0} ${y0} C${xm} ${y0} ${xm} ${y1} ${x1} ${y1} L${x1} ${y1 + width} C${xm} ${y1 + width} ${xm} ${y0 + width} ${x0} ${y0 + width} Z" fill="${GANTT_COLORS[link.source]}" opacity="0.4"><title>${escape(`${STATUS_LABELS[link.source]} → ${STATUS_LABELS[link.target]}: ${link.value}`)}</title></path>`,
    );
  }

  for (const node of placed.values()) {
    const labelX = node.x + NODE_WIDTH + 8;
    // Jobs that are still at this status get a second, quieter line under the count.
    const detail =
      node.current > 0 && node.current !== node.value ? `${node.current} still here` : '';
    const labelY = node.y + node.height / 2 - (detail ? 7 : 0);
    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${Math.max(node.height, 2)}" rx="3" fill="${GANTT_COLORS[node.status]}"><title>${escape(`${STATUS_LABELS[node.status]}: ${node.value}`)}</title></rect>`,
      `<text x="${labelX}" y="${labelY}" dominant-baseline="middle" fill="${theme.text}" font-weight="600">${STATUS_LABELS[node.status]} <tspan fill="${theme.muted}" font-weight="400">${node.value}</tspan></text>`,
    );
    if (detail) {
      parts.push(
        `<text x="${labelX}" y="${labelY + 14}" dominant-baseline="middle" fill="${theme.muted}" font-size="10">${escape(detail)}</text>`,
      );
    }
  }

  parts.push(
    `<text x="${PADDING}" y="${PADDING + 4}" fill="${theme.muted}" font-size="11">How applications moved between statuses. Band width is the number of jobs.</text>`,
    '</svg>',
  );
  return parts.join('');
}
