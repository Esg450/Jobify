import { describe, expect, it } from 'vitest';
import type { TimelineJob } from '../api/types';
import { GANTT_THEMES } from './gantt';
import { buildSankey, renderSankeySvg } from './sankey';

function job(id: number, statuses: TimelineJob['status'][]): TimelineJob {
  const [first, ...rest] = statuses;
  let previous = first;
  return {
    id,
    title: `Job ${id}`,
    company: 'Acme',
    status: statuses[statuses.length - 1],
    appliedOn: '2026-09-01',
    createdAt: '2026-09-01T00:00:00.000Z',
    events: [
      {
        type: 'created',
        fromStatus: null,
        toStatus: first,
        title: null,
        occurredAt: '2026-09-01T00:00:00.000Z',
      },
      ...rest.map((status, index) => {
        const event = {
          type: 'status_change' as const,
          fromStatus: previous,
          toStatus: status,
          title: null,
          occurredAt: `2026-09-0${index + 2}T00:00:00.000Z`,
        };
        previous = status;
        return event;
      }),
    ],
  };
}

describe('buildSankey', () => {
  it('counts the moves between statuses and splits outcomes by the stage they came from', () => {
    const data = buildSankey([
      job(1, ['applied', 'screening', 'interviewing', 'offer']),
      job(2, ['applied', 'screening', 'rejected']),
      job(3, ['applied', 'rejected']),
      job(4, ['saved']),
    ]);

    expect(data.nodes.map((node) => [node.id, node.value])).toEqual([
      ['saved', 1],
      ['applied', 3],
      ['screening', 2],
      ['interviewing', 1],
      ['offer', 1],
      ['rejected@applied', 1],
      ['rejected@screening', 1],
    ]);
    expect(data.links).toContainEqual({ source: 'applied', target: 'screening', value: 2 });
    expect(data.links).toContainEqual({ source: 'applied', target: 'rejected@applied', value: 1 });
    expect(data.links).toContainEqual({
      source: 'screening',
      target: 'rejected@screening',
      value: 1,
    });
  });

  it('uses the current status when the history is incomplete', () => {
    const data = buildSankey([{ ...job(1, ['applied']), status: 'ghosted' }]);
    expect(data.links).toEqual([{ source: 'applied', target: 'ghosted@applied', value: 1 }]);
  });
});

describe('renderSankeySvg', () => {
  it('renders one band per link and labels every node with its count', () => {
    const svg = renderSankeySvg(
      buildSankey([job(1, ['applied', 'screening', 'rejected']), job(2, ['applied', 'offer'])]),
      GANTT_THEMES.light,
    );
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(3);
    expect(svg).toContain('>Applied</text>');
    expect(svg).toContain('Screening → Rejected: 1');
  });

  it('renders an empty chart without data', () => {
    expect(renderSankeySvg(buildSankey([]), GANTT_THEMES.light)).toMatch(/^<svg.*<\/svg>$/);
  });
});
