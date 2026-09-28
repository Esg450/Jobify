import type { JobDraft } from './job-draft.js';
import { cleanText, inferWorkplaceType, normalizeEmploymentType } from './normalize.js';
import {
  companyFromAboutHeading,
  employmentTypeFromText,
  locationFromText,
  parseSalary,
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

  if (!result.salaryMin && !result.salaryMax) {
    const salary = parseSalary(description);
    if (salary) Object.assign(result, salary);
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
