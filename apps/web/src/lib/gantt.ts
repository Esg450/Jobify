import type { JobStatus, TimelineJob } from '../api/types';
import { STATUS_LABELS } from './labels';

/** Statuses after which a job's bar ends instead of running to today. */
const FINAL_STATUSES: JobStatus[] = ['accepted', 'rejected', 'withdrawn', 'ghosted'];

export const GANTT_COLORS: Record<JobStatus, string> = {
  saved: '#a1a1aa',
  applied: '#0ea5e9',
  screening: '#8b5cf6',
  interviewing: '#f59e0b',
  offer: '#10b981',
  accepted: '#16a34a',
  rejected: '#f43f5e',
  withdrawn: '#71717a',
  ghosted: '#94a3b8',
};

export interface GanttSegment {
  status: JobStatus;
  start: Date;
  end: Date;
}

export interface GanttRow {
  id: number;
  title: string;
  company: string;
  status: JobStatus;
  start: Date;
  end: Date;
  segments: GanttSegment[];
  interviews: { date: Date; label: string }[];
}

const DAY = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/**
 * Turns a job's status history into bar segments. A bar starts on the day the job was
 * applied for (or saved), changes colour at every status change, and ends on the day it
 * reached a final status, or today while the application is still open.
 */
export function buildGanttRows(jobs: TimelineJob[], today = new Date()): GanttRow[] {
  const end = startOfDay(today);

  const rows = jobs.map((job): GanttRow => {
    const start = startOfDay(job.appliedOn ? calendarDate(job.appliedOn) : new Date(job.createdAt));
    const created = job.events.find((event) => event.type === 'created');
    const statusChanges = job.events.filter(
      (event) => event.type === 'status_change' && event.toStatus,
    );
    const changes = statusChanges.map((event) => ({
      status: event.toStatus!,
      date: startOfDay(new Date(event.occurredAt)),
    }));

    const segments: GanttSegment[] = [];
    let currentStatus: JobStatus = created?.toStatus ?? statusChanges[0]?.fromStatus ?? job.status;
    let currentStart = start;
    for (const change of changes) {
      const at = change.date < currentStart ? currentStart : change.date;
      if (at > currentStart) segments.push({ status: currentStatus, start: currentStart, end: at });
      currentStatus = change.status;
      currentStart = at;
    }
    // Final statuses end the bar on the day they were reached (or, for jobs added to Jobify
    // already in that state, the day they were added); open ones run to today.
    const reachedOn =
      changes.length > 0
        ? currentStart
        : startOfDay(created ? new Date(created.occurredAt) : new Date(job.createdAt));
    const barEnd = FINAL_STATUSES.includes(job.status)
      ? new Date(Math.max(reachedOn.getTime(), currentStart.getTime()))
      : end;
    const lastEnd = new Date(Math.max(barEnd.getTime(), currentStart.getTime() + DAY));
    segments.push({ status: job.status, start: currentStart, end: lastEnd });

    return {
      id: job.id,
      title: job.title,
      company: job.company,
      status: job.status,
      start,
      end: lastEnd,
      segments,
      interviews: job.events
        .filter((event) => event.type === 'interview')
        .map((event) => ({ date: new Date(event.occurredAt), label: event.title ?? 'Interview' })),
    };
  });

  return rows.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id - b.id);
}

export interface GanttTheme {
  background: string;
  text: string;
  muted: string;
  grid: string;
  today: string;
}

export const GANTT_THEMES: Record<'light' | 'dark', GanttTheme> = {
  light: {
    background: '#ffffff',
    text: '#18181b',
    muted: '#71717a',
    grid: '#e4e4e7',
    today: '#4f46e5',
  },
  dark: {
    background: '#09090b',
    text: '#f4f4f5',
    muted: '#a1a1aa',
    grid: '#27272a',
    today: '#818cf8',
  },
};

const LABEL_WIDTH = 250;
const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 44;
const LEGEND_HEIGHT = 44;
const PADDING = 16;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Renders the chart as a self-contained SVG document, suitable for saving or embedding. */
export function renderGanttSvg(rows: GanttRow[], theme: GanttTheme, today = new Date()): string {
  const dayStart = startOfDay(today);
  const rangeStart = rows.length
    ? new Date(Math.min(...rows.map((row) => row.start.getTime())) - 2 * DAY)
    : new Date(dayStart.getTime() - 30 * DAY);
  const lastDate = Math.max(
    dayStart.getTime(),
    ...rows.map((row) => row.end.getTime()),
    ...rows.flatMap((row) => row.interviews.map((interview) => interview.date.getTime())),
  );
  const rangeEnd = new Date(lastDate + 3 * DAY);
  const days = Math.max(14, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY));
  const plotWidth = Math.min(1400, Math.max(640, days * 9));
  const dayWidth = plotWidth / days;
  const x = (date: Date) =>
    LABEL_WIDTH + PADDING + ((startOfDay(date).getTime() - rangeStart.getTime()) / DAY) * dayWidth;

  const width = LABEL_WIDTH + plotWidth + PADDING * 2;
  const height = PADDING + HEADER_HEIGHT + rows.length * ROW_HEIGHT + LEGEND_HEIGHT + PADDING;
  const plotTop = PADDING + HEADER_HEIGHT;
  const plotBottom = plotTop + rows.length * ROW_HEIGHT;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" font-size="12">`,
    `<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
  );

  // Month boundaries, with week lines when the range is short enough to read them.
  const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
  const weekly = days <= 120;
  for (
    let cursor = new Date(rangeStart);
    cursor <= rangeEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const isMonthStart = cursor.getDate() === 1;
    const isWeekStart = weekly && cursor.getDay() === 1;
    if (!isMonthStart && !isWeekStart) continue;
    const px = x(cursor);
    parts.push(
      `<line x1="${px}" y1="${plotTop}" x2="${px}" y2="${plotBottom}" stroke="${theme.grid}" stroke-width="${isMonthStart ? 1.5 : 1}"/>`,
    );
    if (isMonthStart || cursor.getTime() === startOfDay(rangeStart).getTime()) {
      parts.push(
        `<text x="${px + 4}" y="${PADDING + 16}" fill="${theme.text}" font-weight="600">${escape(monthFormat.format(cursor))}</text>`,
      );
    } else if (weekly) {
      parts.push(
        `<text x="${px + 3}" y="${PADDING + 34}" fill="${theme.muted}" font-size="10">${cursor.getDate()}</text>`,
      );
    }
  }

  rows.forEach((row, index) => {
    const y = plotTop + index * ROW_HEIGHT;
    if (index % 2 === 1) {
      parts.push(
        `<rect x="${PADDING}" y="${y}" width="${width - PADDING * 2}" height="${ROW_HEIGHT}" fill="${theme.grid}" opacity="0.35"/>`,
      );
    }
    parts.push(
      `<text x="${PADDING}" y="${y + 13}" fill="${theme.text}" font-weight="600">${escape(truncate(row.title, 34))}</text>`,
      `<text x="${PADDING}" y="${y + 25}" fill="${theme.muted}" font-size="10">${escape(truncate(row.company, 40))}</text>`,
    );
    for (const segment of row.segments) {
      const left = x(segment.start);
      const right = Math.max(x(segment.end), left + 3);
      parts.push(
        `<rect x="${left}" y="${y + 8}" width="${right - left}" height="${ROW_HEIGHT - 16}" rx="3" fill="${GANTT_COLORS[segment.status]}"><title>${escape(`${row.title}: ${STATUS_LABELS[segment.status]}`)}</title></rect>`,
      );
    }
    for (const interview of row.interviews) {
      const cx = x(interview.date) + dayWidth / 2;
      const cy = y + ROW_HEIGHT / 2;
      parts.push(
        `<path d="M${cx} ${cy - 7} L${cx + 7} ${cy} L${cx} ${cy + 7} L${cx - 7} ${cy} Z" fill="${theme.background}" stroke="${theme.text}" stroke-width="1.5"><title>${escape(interview.label)}</title></path>`,
      );
    }
  });

  const todayX = x(dayStart) + dayWidth / 2;
  parts.push(
    `<line x1="${todayX}" y1="${plotTop}" x2="${todayX}" y2="${plotBottom + 4}" stroke="${theme.today}" stroke-width="1.5" stroke-dasharray="4 3"/>`,
    `<text x="${todayX}" y="${plotBottom + 14}" fill="${theme.today}" font-size="10" font-weight="600" text-anchor="middle">Today</text>`,
  );

  // Legend
  let legendX = PADDING;
  const legendY = plotBottom + 32;
  for (const status of Object.keys(GANTT_COLORS) as JobStatus[]) {
    parts.push(
      `<rect x="${legendX}" y="${legendY - 9}" width="12" height="12" rx="2" fill="${GANTT_COLORS[status]}"/>`,
      `<text x="${legendX + 16}" y="${legendY + 1}" fill="${theme.muted}" font-size="11">${STATUS_LABELS[status]}</text>`,
    );
    legendX += 30 + STATUS_LABELS[status].length * 6.5;
  }
  parts.push(
    `<path d="M${legendX + 6} ${legendY - 10} L${legendX + 13} ${legendY - 3} L${legendX + 6} ${legendY + 4} L${legendX - 1} ${legendY - 3} Z" fill="${theme.background}" stroke="${theme.text}" stroke-width="1.5"/>`,
    `<text x="${legendX + 18}" y="${legendY + 1}" fill="${theme.muted}" font-size="11">Interview</text>`,
    '</svg>',
  );

  return parts.join('');
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, filename: string): void {
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Rasterises the SVG at 2x for a crisp PNG. */
export function downloadPng(svg: string, filename: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Could not draw the chart'));
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not create the image'));
        download(blob, filename);
        resolve();
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the chart'));
    };
    image.src = url;
  });
}
