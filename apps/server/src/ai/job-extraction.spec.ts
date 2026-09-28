import { describe, expect, it } from 'vitest';
import { parseExtractedJob } from './job-extraction.js';

describe('parseExtractedJob', () => {
  it('extracts JSON surrounded by prose and code fences', () => {
    const answer =
      'Here you go:\n```json\n{"title":"Chef","company":"Bistro","workplaceType":"Onsite","salaryMin":"45,000","salaryCurrency":"eur","employmentType":"Part-time"}\n```';
    expect(parseExtractedJob(answer)).toMatchObject({
      title: 'Chef',
      company: 'Bistro',
      workplaceType: 'onsite',
      salaryMin: 45000,
      salaryCurrency: 'EUR',
      employmentType: 'part_time',
    });
  });

  it('discards values of the wrong type or outside the allowed set', () => {
    const draft = parseExtractedJob(
      '{"title": 42, "workplaceType": "moon base", "postedOn": "soon"}',
    );
    expect(draft.title).toBeUndefined();
    expect(draft.workplaceType).toBeUndefined();
    expect(draft.postedOn).toBeUndefined();
  });

  it('throws when there is no JSON', () => {
    expect(() => parseExtractedJob('Sorry, I cannot help.')).toThrow('did not contain JSON');
  });
});
