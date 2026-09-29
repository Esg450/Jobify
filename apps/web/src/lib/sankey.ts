import type { JobStatus, TimelineJob } from '../api/types';
import type { GanttTheme } from './gantt';
import { STATUS_LABELS } from './labels';

/** The pipeline, left to right. Anything else is an outcome that branches off it. */
const PIPELINE: JobStatus[] = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
];
const OUTCOMES: JobStatus[] = ['rejected', 'withdrawn', 'ghosted'];

/** Soft colours: nodes are solid, bands are a translucent wash of their target's colour. */
export const SANKEY_COLORS: Record<JobStatus, string> = {
  saved: '#a8a29e',
  applied: '#7b9bc9',
  screening: '#a892d9',
  interviewing: '#6fb3b8',
  offer: '#79c2a3',
  accepted: '#5fa85a',
  rejected: '#f2b06b',
  withdrawn: '#e6c463',
  ghosted: '#e58585',
};

export interface SankeyNode {
  /** Pipeline statuses are one node each; outcomes get one node per status they came from. */
  id: string;
  status: JobStatus;
  label: string;
  /** Jobs that reached this node. */
  value: number;
}

export interface SankeyLink {
  source: string;
  target: string;
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

function nodeId(status: JobStatus, previous: JobStatus | undefined): string {
  return OUTCOMES.includes(status) && previous ? `${status}@${previous}` : status;
}

/**
 * Counts how applications moved between statuses. Outcomes are split by the stage they
 * were reached from, so "Rejected" after screening and "Rejected" after an interview are
 * separate branches, which reads as a tree.
 */
export function buildSankey(jobs: TimelineJob[]): SankeyData {
  const values = new Map<string, SankeyNode>();
  const links = new Map<string, SankeyLink>();
  const bump = (id: string, status: JobStatus) => {
    const node = values.get(id) ?? { id, status, label: STATUS_LABELS[status], value: 0 };
    node.value++;
    values.set(id, node);
  };

  for (const job of jobs) {
    const path = statusPath(job);
    let previousId: string | undefined;
    path.forEach((status, index) => {
      const id = nodeId(status, path[index - 1]);
      bump(id, status);
      if (previousId) {
        const key = `${previousId}→${id}`;
        const link = links.get(key) ?? { source: previousId, target: id, value: 0 };
        link.value++;
        links.set(key, link);
      }
      previousId = id;
    });
  }

  // Pipeline stages first, then outcomes by status and by the stage they came from.
  const order = (node: SankeyNode) =>
    (PIPELINE.includes(node.status) ? PIPELINE : OUTCOMES).indexOf(node.status);
  const origin = (node: SankeyNode) => PIPELINE.indexOf(node.id.split('@')[1] as JobStatus);
  const nodes = [...values.values()].sort(
    (a, b) =>
      Number(OUTCOMES.includes(a.status)) - Number(OUTCOMES.includes(b.status)) ||
      order(a) - order(b) ||
      origin(a) - origin(b),
  );
  return { nodes, links: [...links.values()] };
}

const WIDTH = 960;
const HEIGHT = 520;
const PADDING = 24;
const LABEL_SPACE = 130;
const NODE_WIDTH = 12;
const NODE_GAP = 40;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

interface PlacedNode extends SankeyNode {
  column: number;
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.background}"/>`,
  ];
  if (data.nodes.length === 0) return `${parts.join('')}</svg>`;

  // Pipeline stages take the columns in order; an outcome sits right after its source.
  const stages = PIPELINE.filter((status) => data.nodes.some((node) => node.id === status));
  const column = (node: SankeyNode): number =>
    PIPELINE.includes(node.status)
      ? stages.indexOf(node.status)
      : stages.indexOf(node.id.split('@')[1] as JobStatus) + 1;
  const columnCount = Math.max(...data.nodes.map(column)) + 1;
  const plotLeft = PADDING + 8;
  const plotRight = WIDTH - PADDING - LABEL_SPACE - NODE_WIDTH;
  const columnX = (index: number) =>
    columnCount === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft + (index * (plotRight - plotLeft)) / (columnCount - 1);

  const byColumn = new Map<number, SankeyNode[]>();
  for (const node of data.nodes) {
    const index = column(node);
    byColumn.set(index, [...(byColumn.get(index) ?? []), node]);
  }
  const plotHeight = HEIGHT - PADDING * 2;
  const scale = Math.min(
    ...[...byColumn.values()].map(
      (list) =>
        (plotHeight - NODE_GAP * (list.length - 1)) /
        list.reduce((sum, node) => sum + node.value, 0),
    ),
  );

  // Place columns left to right so each node can follow the node most of its jobs came from.
  const placed = new Map<string, PlacedNode>();
  const parentY = (node: SankeyNode) => {
    const main = data.links
      .filter((link) => link.target === node.id && placed.has(link.source))
      .sort((a, b) => b.value - a.value)[0];
    return main ? placed.get(main.source)!.y : 0;
  };
  for (let index = 0; index < columnCount; index++) {
    const list = (byColumn.get(index) ?? []).sort(
      (a, b) =>
        parentY(a) - parentY(b) ||
        Number(OUTCOMES.includes(a.status)) - Number(OUTCOMES.includes(b.status)) ||
        OUTCOMES.indexOf(a.status) - OUTCOMES.indexOf(b.status),
    );
    const total =
      list.reduce((sum, node) => sum + node.value * scale, 0) + NODE_GAP * (list.length - 1);
    let y = PADDING + (plotHeight - total) / 2;
    for (const node of list) {
      const height = Math.max(node.value * scale, 3);
      placed.set(node.id, {
        ...node,
        column: index,
        x: columnX(index),
        y,
        height,
        outY: y,
        inY: y,
      });
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
      `<path d="M${x0} ${y0} C${xm} ${y0} ${xm} ${y1} ${x1} ${y1} L${x1} ${y1 + width} C${xm} ${y1 + width} ${xm} ${y0 + width} ${x0} ${y0 + width} Z" fill="${SANKEY_COLORS[target.status]}" opacity="0.45"><title>${escape(`${source.label} → ${target.label}: ${link.value}`)}</title></path>`,
    );
  }

  for (const node of placed.values()) {
    const cy = node.y + node.height / 2;
    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${node.height}" rx="2" fill="${SANKEY_COLORS[node.status]}"><title>${escape(`${node.label}: ${node.value}`)}</title></rect>`,
      `<text x="${node.x + NODE_WIDTH + 10}" y="${cy - 3}" fill="${theme.text}" font-size="20" font-weight="600">${node.value}</text>`,
      `<text x="${node.x + NODE_WIDTH + 10}" y="${cy + 15}" fill="${theme.text}" font-size="13">${escape(node.label)}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('');
}
