/** The job boards JobSpy can search, with the names shown in the UI and saved as a job's source. */
export const SEARCH_SITES = {
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  zip_recruiter: 'ZipRecruiter',
  glassdoor: 'Glassdoor',
  google: 'Google Jobs',
  bayt: 'Bayt',
  naukri: 'Naukri',
  bdjobs: 'BDJobs',
  hellowork: 'HelloWork',
} as const;
export type SearchSite = keyof typeof SEARCH_SITES;
export const SEARCH_SITE_IDS = Object.keys(SEARCH_SITES) as SearchSite[];

/** Boards selected when the user has not picked any. */
export const DEFAULT_SEARCH_SITES: SearchSite[] = ['indeed', 'linkedin'];

export const SEARCH_JOB_TYPES = ['fulltime', 'parttime', 'contract', 'internship'] as const;
export type SearchJobType = (typeof SEARCH_JOB_TYPES)[number];

export const MAX_SEARCH_RESULTS = 100;
