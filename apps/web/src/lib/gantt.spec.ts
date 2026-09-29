import { describe, expect, it } from 'vitest';
import type { TimelineJob } from '../api/types';
import { buildGanttRows, GANTT_THEMES, renderGanttSvg } from './gantt';

const TODAY = new Date('2026-09-29T12:00:00');

const JOB: TimelineJob = {
  id: 1,
  title: 'Engineer',
  company: 'Acme',
  status: 'interviewing',
  appliedOn: '2026-09-01',
  createdAt: '2026-09-01T10:00:00.000Z',
  events: [
    {
      type: 'created',
      fromStatus: null,
      toStatus: 'applied',
      title: null,
      occurredAt: '2026-09-01T10:00:00.000Z',
    },
    {
      type: 'status_change',
      fromStatus: 'applied',
      toStatus: 'interviewing',
      title: null,
      occurredAt: '2026-09-15T10:00:00.000Z',
    },
    {
      type: 'interview',
      fromStatus: null,
      toStatus: null,
      title: 'Onsite',
      occurredAt: '2026-10-02T15:00:00.000Z',
    },
  ],
};

describe('buildGanttRows', () => {
  it('splits a bar at every status change and runs open jobs to today', () => {
    const [row] = buildGanttRows([JOB], TODAY);
    expect(row.segments.map((segment) => segment.status)).toEqual(['applied', 'interviewing']);
    expect(row.segments[0].start.toDateString()).toBe(
      new Date('2026-09-01T00:00:00').toDateString(),
    );
    expect(row.segments[1].end.toDateString()).toBe(new Date('2026-09-29T00:00:00').toDateString());
    expect(row.interviews).toEqual([
      { date: new Date('2026-10-02T15:00:00.000Z'), label: 'Onsite' },
    ]);
  });

  it('ends a bar on the day a final status was reached', () => {
    const rejected: TimelineJob = {
      ...JOB,
      status: 'rejected',
      events: [
        JOB.events[0],
        {
          type: 'status_change',
          fromStatus: 'applied',
          toStatus: 'rejected',
          title: null,
          occurredAt: '2026-09-10T10:00:00.000Z',
        },
      ],
    };
    const [row] = buildGanttRows([rejected], TODAY);
    // The bar covers the day the status was reached, so it ends the following midnight.
    expect(row.end.toDateString()).toBe(new Date('2026-09-11T00:00:00').toDateString());
  });

  it('sorts rows by start date', () => {
    const later = { ...JOB, id: 2, appliedOn: '2026-09-20' };
    expect(buildGanttRows([later, JOB], TODAY).map((row) => row.id)).toEqual([1, 2]);
  });
});

describe('renderGanttSvg', () => {
  it('produces a self-contained SVG with the job, its bars and the interview', () => {
    const svg = renderGanttSvg(buildGanttRows([JOB], TODAY), GANTT_THEMES.light, TODAY);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('Engineer');
    expect((svg.match(/rx="3"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('<title>Onsite</title>');
    expect(svg).toContain('>Today<');
  });

  it('escapes titles', () => {
    const svg = renderGanttSvg(
      buildGanttRows([{ ...JOB, title: 'R&D <Lead>' }], TODAY),
      GANTT_THEMES.dark,
      TODAY,
    );
    expect(svg).toContain('R&#38;D &#60;Lead&#62;');
    expect(svg).not.toContain('<Lead>');
  });
});
