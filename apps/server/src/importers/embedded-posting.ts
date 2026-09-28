import * as cheerio from 'cheerio';

/** Hosts of applicant tracking systems that companies embed on their own careers pages. */
const EMBEDDABLE_POSTING = [
  /^https:\/\/jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{36}/,
  /^https:\/\/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_app\?|[^/]+\/jobs\/\d+)/,
  /^https:\/\/jobs\.(?:eu\.)?lever\.co\/[^/]+\/[0-9a-f-]{36}/,
  /^https:\/\/[^/]+\.myworkdayjobs\.com\/.*\/job\//,
];

/**
 * Many companies show postings from their applicant tracking system inside their own careers
 * page, either in an iframe or through a script that reads the job id from the URL
 * (`?ashby_jid=...`, `?gh_jid=...`). Returns the posting's URL on the ATS, where a dedicated
 * parser can read it, or undefined if the page does not embed a single posting.
 */
export function findEmbeddedPosting(html: string, pageUrl?: URL): string | undefined {
  const $ = cheerio.load(html);

  for (const frame of $('iframe[src]').toArray()) {
    const src = absolute($(frame).attr('src')!, pageUrl);
    if (src && EMBEDDABLE_POSTING.some((pattern) => pattern.test(src))) return src;
  }

  const ashbyJob = pageUrl?.searchParams.get('ashby_jid');
  const ashbyBoard = html.match(/jobs\.ashbyhq\.com\/([\w.-]+)(?:\/embed|["'])/)?.[1];
  if (ashbyJob && ashbyBoard) return `https://jobs.ashbyhq.com/${ashbyBoard}/${ashbyJob}`;

  const greenhouseJob = pageUrl?.searchParams.get('gh_jid');
  const greenhouseBoard = html.match(
    /greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([\w.-]+)/,
  )?.[1];
  if (greenhouseJob && greenhouseBoard) {
    return `https://boards.greenhouse.io/embed/job_app?for=${greenhouseBoard}&token=${greenhouseJob}`;
  }

  return undefined;
}

function absolute(src: string, base?: URL): string | undefined {
  try {
    return new URL(src, base).toString();
  } catch {
    return undefined;
  }
}
