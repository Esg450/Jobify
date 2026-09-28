import type { JobDraft } from '../importers/job-draft.js';
import {
  cleanText,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  toCalendarDate,
  toWholeNumber,
} from '../importers/normalize.js';
import { WORKPLACE_TYPES, type WorkplaceType } from '../jobs/job.constants.js';

/** Parses a model's JSON answer defensively, discarding anything that is not a valid field. */
export function parseExtractedJob(answer: string): JobDraft {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI response did not contain JSON');

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error('The AI response was not valid JSON');
  }

  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : undefined);
  const workplaceType = text('workplaceType')?.toLowerCase();

  return {
    title: cleanText(text('title')),
    company: cleanText(text('company')),
    location: cleanText(text('location')),
    workplaceType: WORKPLACE_TYPES.includes(workplaceType as WorkplaceType)
      ? (workplaceType as WorkplaceType)
      : undefined,
    employmentType: normalizeEmploymentType(text('employmentType')),
    salaryMin: toWholeNumber(data.salaryMin),
    salaryMax: toWholeNumber(data.salaryMax),
    salaryCurrency: text('salaryCurrency')?.toUpperCase().slice(0, 3),
    salaryPeriod: normalizeSalaryPeriod(text('salaryPeriod')),
    postedOn: toCalendarDate(text('postedOn')),
    deadlineOn: toCalendarDate(text('deadlineOn')),
    description: text('description')?.trim() || undefined,
  };
}
