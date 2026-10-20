import type { JobDraft } from './job-draft.js';
import { cleanText, inferWorkplaceType, normalizeEmploymentType } from './normalize.js';
import {
  companyFromAboutHeading,
  employmentTypeFromText,
  locationFromText,
  parseSalaries,
  splitPageTitle,
  workplaceTypeFromText,
} from './text-signals.js';

/**
 * Fills in whatever a parser could not find by reading the draft's own text: the salary
 * quoted in the description, "Remote" in the title, a "Location:" line, and so on. Never
 * overwrites a value that is already set.
 */
export function enrichDraft(draft: JobDraft): JobDraft {
  const result = { ...draft };
  const description = result.description ?? '';

  if (result.title && !result.company) {
    const parts = splitPageTitle(result.title, undefined, { dashes: false });
    if (parts?.company) {
      result.title = parts.title;
      result.company = parts.company;
    }
  }
  result.company ??= companyFromAboutHeading(description);

  result.location ??= locationFromText(description);
  result.location = cleanText(result.location);

  result.workplaceType ??=
    inferWorkplaceType(result.title, result.location) ?? workplaceTypeFromText(description);

  result.employmentType ??=
    normalizeEmploymentType(titleEmploymentHint(result.title)) ??
    employmentTypeFromText(description);

  if (!result.salaryRanges) {
    const ranges = parseSalaries(description);
    if (ranges.length > 1) {
      // Several ranges, usually one per location: the user picks the one that applies to
      // them instead of the first one being taken as the salary.
      result.salaryRanges = ranges;
    } else if (ranges.length === 1 && !result.salaryMin && !result.salaryMax) {
      const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = ranges[0];
      Object.assign(result, { salaryMin, salaryMax, salaryCurrency, salaryPeriod });
    }
  }

  return result;
}

/** "(Contract)", "Intern", "- Part Time" in a title are reliable employment hints. */
function titleEmploymentHint(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const match =
    /\b(intern(?:ship)?|part[\s-]?time|full[\s-]?time|contract(?:or)?|temporary|seasonal|freelance)\b/i.exec(
      title,
    );
  return match?.[1];
}
