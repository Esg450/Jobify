import { describe, expect, it } from 'vitest';
import {
  htmlToMarkdown,
  inferWorkplaceType,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  toCalendarDate,
  toWholeNumber,
} from './normalize.js';

describe('htmlToMarkdown', () => {
  it('converts headings and lists', () => {
    expect(htmlToMarkdown('<h2>About</h2><ul><li>One</li><li>Two</li></ul>')).toBe(
      '## About\n\n- One\n- Two',
    );
  });

  it('moves line breaks out of bold text', () => {
    expect(htmlToMarkdown('<strong>Job Description<br><br></strong>We build things.')).toBe(
      '**Job Description**\n\nWe build things.',
    );
  });

  it('drops scripts and returns undefined for empty input', () => {
    expect(htmlToMarkdown('<script>alert(1)</script>')).toBeUndefined();
    expect(htmlToMarkdown('   ')).toBeUndefined();
  });
});

describe('inferWorkplaceType', () => {
  it.each([
    ['Remote - US', 'remote'],
    ['New York (Hybrid)', 'hybrid'],
    ['On-site in Berlin', 'onsite'],
    ['London', undefined],
  ])('%s -> %s', (text, expected) => {
    expect(inferWorkplaceType(text)).toBe(expected);
  });

  it('prefers hybrid when a posting mentions both', () => {
    expect(inferWorkplaceType('Hybrid, remote Fridays')).toBe('hybrid');
  });
});

describe('normalizeEmploymentType', () => {
  it.each([
    ['FULL_TIME', 'full_time'],
    ['Full-time', 'full_time'],
    ['FullTime', 'full_time'],
    ['Part time', 'part_time'],
    ['CONTRACTOR', 'contract'],
    ['Internship', 'internship'],
    ['Temporary', 'temporary'],
    ['Volunteer', undefined],
  ])('%s -> %s', (text, expected) => {
    expect(normalizeEmploymentType(text)).toBe(expected);
  });
});

describe('value helpers', () => {
  it('normalizes salary periods', () => {
    expect(normalizeSalaryPeriod('1 YEAR')).toBe('year');
    expect(normalizeSalaryPeriod('per-hour-wage')).toBe('hour');
    expect(normalizeSalaryPeriod('HOUR')).toBe('hour');
  });

  it('formats dates', () => {
    expect(toCalendarDate('2026-03-12T10:00:00.000Z')).toBe('2026-03-12');
    expect(toCalendarDate(1_786_000_000_000)).toBe('2026-08-06');
    expect(toCalendarDate('not a date')).toBeUndefined();
  });

  it('parses numbers', () => {
    expect(toWholeNumber('$120,000')).toBe(120000);
    expect(toWholeNumber(99.6)).toBe(100);
    expect(toWholeNumber('n/a')).toBeUndefined();
  });
});
