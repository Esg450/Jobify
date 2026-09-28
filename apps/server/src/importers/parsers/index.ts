import type { JobParser } from '../job-parser.js';
import { AshbyParser } from './ashby.parser.js';
import { EmbeddedJsonParser } from './embedded-json.parser.js';
import { GreenhouseParser } from './greenhouse.parser.js';
import { JsonLdParser } from './json-ld.parser.js';
import { LeverParser } from './lever.parser.js';
import { LinkedInParser } from './linkedin.parser.js';
import { OracleHcmParser } from './oracle-hcm.parser.js';
import { RenderedPageParser } from './rendered-page.parser.js';
import { SmartRecruitersParser } from './smartrecruiters.parser.js';
import { WebPageParser } from './web-page.parser.js';
import { WorkableParser } from './workable.parser.js';
import { WorkdayParser } from './workday.parser.js';

/**
 * Parsers in priority order. Site-specific parsers (which use a job board's API) come
 * first, then the generic ones, from most to least reliable:
 *
 * - JSON-LD structured data, which most job boards publish for search engines
 * - the rendered markup of well-known sites, for pages pasted from a browser
 * - job data embedded as JSON in the page's scripts
 * - the page title, tags and largest description-like block, as a last resort
 *
 * Register new parsers here.
 */
export const JOB_PARSERS: readonly JobParser[] = [
  new WorkdayParser(),
  new GreenhouseParser(),
  new LeverParser(),
  new AshbyParser(),
  new SmartRecruitersParser(),
  new WorkableParser(),
  new OracleHcmParser(),
  new LinkedInParser(),
  new JsonLdParser(),
  new RenderedPageParser(),
  new EmbeddedJsonParser(),
  new WebPageParser(),
];
