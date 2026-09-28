import { describe, expect, it } from 'vitest';
import { StatsService } from './stats.service.js';

describe('StatsService.weeklyApplications', () => {
  // Wednesday
  const now = new Date('2026-09-30T12:00:00Z');

  it('returns twelve Monday-based weeks ending with the current one', () => {
    const weeks = StatsService.weeklyApplications([], now);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)?.week).toBe('2026-09-28');
    expect(weeks[0].week).toBe('2026-07-13');
  });

  it('counts applications into their week and ignores older ones', () => {
    const weeks = StatsService.weeklyApplications(
      ['2026-09-28', '2026-10-04', '2026-09-27', '2025-01-01'],
      now,
    );
    expect(weeks.at(-1)?.count).toBe(2);
    expect(weeks.at(-2)?.count).toBe(1);
    expect(weeks.reduce((total, week) => total + week.count, 0)).toBe(3);
  });
});
