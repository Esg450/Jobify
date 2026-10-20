// Shared with non-DTO code (the resume extractor, the AI tidy route), so it lives outside the
// decorated DTO module.

/** Longest resume the profile stores, in characters. Mirrored in the web app's types. */
export const RESUME_MAX_LENGTH = 50_000;

/** Largest resume file the upload route accepts. Resumes are a few hundred kilobytes at most. */
export const RESUME_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** How an uploaded resume was read. */
export const RESUME_FILE_FORMATS = ['pdf', 'docx', 'text'] as const;
export type ResumeFileFormat = (typeof RESUME_FILE_FORMATS)[number];
