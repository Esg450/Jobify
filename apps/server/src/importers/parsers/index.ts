import type { JobParser } from '../job-parser.js';
import { AshbyParser } from './ashby.parser.js';
import { GreenhouseParser } from './greenhouse.parser.js';
import { JsonLdParser } from './json-ld.parser.js';
import { LeverParser } from './lever.parser.js';
import { LinkedInParser } from './linkedin.parser.js';
import { MetaTagsParser } from './meta-tags.parser.js';
import { SmartRecruitersParser } from './smartrecruiters.parser.js';
import { WorkdayParser } from './workday.parser.js';

/**
 * Parsers in priority order. Site-specific parsers come first; the generic ones at the
 * end fill in anything still missing. Register new parsers here.
 */
export const JOB_PARSERS: readonly JobParser[] = [
  new WorkdayParser(),
  new GreenhouseParser(),
  new LeverParser(),
  new AshbyParser(),
  new SmartRecruitersParser(),
  new LinkedInParser(),
  new JsonLdParser(),
  new MetaTagsParser(),
];
