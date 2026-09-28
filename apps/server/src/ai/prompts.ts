import type { Job } from '../database/schema.js';
import type { Profile } from '../settings/profile.dto.js';
import type { CompletionRequest } from './providers/ai-provider.js';

export const AI_TASKS = ['summary', 'description', 'cover-letter', 'interview-prep'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** The job field each task writes its result to. */
export const AI_TASK_FIELDS = {
  summary: 'aiSummary',
  description: 'description',
  'cover-letter': 'coverLetter',
  'interview-prep': 'interviewPrep',
} as const satisfies Record<AiTask, keyof Job>;

const SYSTEM_PROMPT = `You are an assistant inside Jobify, a personal job application tracker. \
You help one job seeker understand postings and prepare applications. \
Be specific to the posting in front of you, stay factual, and never invent details about the \
company or the candidate. Respond with GitHub-flavored Markdown unless told otherwise, and do \
not wrap the whole response in a code block.`;

function describeJob(job: Job): string {
  const facts = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location && `Location: ${job.location}`,
    job.workplaceType && `Workplace: ${job.workplaceType}`,
    job.employmentType && `Employment type: ${job.employmentType.replace('_', ' ')}`,
    (job.salaryMin || job.salaryMax) &&
      `Salary: ${[job.salaryMin, job.salaryMax].filter(Boolean).join(' - ')} ${job.salaryCurrency ?? ''} per ${job.salaryPeriod ?? 'year'}`,
  ].filter(Boolean);

  return `<job>\n${facts.join('\n')}\n\n<description>\n${job.description?.trim() || '(no description saved)'}\n</description>\n</job>`;
}

function describeProfile(profile: Profile): string | undefined {
  const parts = [
    profile.name && `Name: ${profile.name}`,
    profile.headline && `Headline: ${profile.headline}`,
    profile.preferences && `What they are looking for: ${profile.preferences}`,
    profile.resume && `Resume:\n${profile.resume}`,
  ].filter(Boolean);
  return parts.length ? `<candidate>\n${parts.join('\n')}\n</candidate>` : undefined;
}

const TASK_INSTRUCTIONS: Record<AiTask, (hasProfile: boolean) => string> = {
  summary: (
    hasProfile,
  ) => `Summarize this posting so the candidate can decide quickly whether to apply. Use these sections:
## At a glance
Two or three sentences on what the role is and the team or product.
## Responsibilities
## Requirements
Separate must-haves from nice-to-haves when the posting makes the distinction.
## Compensation and benefits
Only what the posting states; write "Not stated" if nothing is mentioned.
## Questions and flags
Anything vague, unusual or worth clarifying with the recruiter.${
    hasProfile
      ? `
## Fit
How the candidate's background lines up with the requirements, including gaps.`
      : ''
  }
Keep the whole summary under 400 words.`,

  description:
    () => `Rewrite the job description as clean, well-structured Markdown. Keep all of the \
original information and meaning, use headings and bullet lists where they help, and remove \
leftover page furniture such as navigation text, "Apply now" buttons or cookie notices. Do not \
add anything that is not in the original. Return only the rewritten description.`,

  'cover-letter': (hasProfile) => `Write a cover letter for this role${
    hasProfile ? " based on the candidate's background" : ''
  }. Keep it between 250 and 350 words, in a confident but natural tone, and connect specific \
requirements from the posting to concrete experience. Avoid clichés such as "I am writing to \
express my interest". ${
    hasProfile
      ? 'Only mention experience that appears in the candidate information.'
      : 'The candidate has not shared their background, so use short bracketed placeholders like [relevant project] where specifics are needed.'
  } Return only the letter, starting with the greeting.`,

  'interview-prep': (
    hasProfile,
  ) => `Prepare the candidate for interviews for this role. Use these sections:
## Likely questions
Eight to twelve questions an interviewer is likely to ask, mixing behavioral and role-specific ones, each with a one-line note on what a strong answer covers.
## Questions to ask them
Five thoughtful questions about the team, the work and expectations.
## Topics to review
Skills, tools or domain knowledge from the posting worth brushing up on.${
    hasProfile
      ? `
## Stories to prepare
Experiences from the candidate's background that map well to this role.`
      : ''
  }`,
};

export function buildTaskPrompt(task: AiTask, job: Job, profile: Profile): CompletionRequest {
  const candidate = describeProfile(profile);
  return {
    system: SYSTEM_PROMPT,
    prompt: [describeJob(job), candidate, TASK_INSTRUCTIONS[task](Boolean(candidate))]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function buildExtractionPrompt(pageText: string): CompletionRequest {
  return {
    system: SYSTEM_PROMPT,
    maxTokens: 8_000,
    prompt: `Extract the job posting from the page text below.

<page>
${pageText.slice(0, 60_000)}
</page>

Respond with a single JSON object and nothing else. Use these keys, omitting any the page does not state:
- "title": string
- "company": string
- "location": string
- "workplaceType": one of "remote", "hybrid", "onsite"
- "employmentType": one of "full_time", "part_time", "contract", "internship", "temporary", "freelance"
- "salaryMin", "salaryMax": numbers without currency symbols
- "salaryCurrency": ISO 4217 code such as "USD"
- "salaryPeriod": one of "year", "month", "week", "day", "hour"
- "postedOn", "deadlineOn": dates as YYYY-MM-DD
- "description": the full job description as Markdown, without page navigation or boilerplate`,
  };
}
