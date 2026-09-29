/**
 * Development helper that fills a user's tracker with realistic demo applications so the
 * list, board, dashboard and charts have something to show:
 *
 *   npm run seed -w apps/server              # seed the first admin
 *   npm run seed -w apps/server -- <username>
 *   npm run seed -w apps/server -- --remove  # delete the demo jobs again
 *
 * Demo jobs are tagged "demo" and have source "demo", which is how --remove finds them.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { loadConfig } from './config/configuration.js';
import { openDatabase, type Database } from './database/database.js';
import { jobEvents, jobs, users } from './database/schema.js';
import type { JobStatus } from './jobs/job.constants.js';

const DEMO_SOURCE = 'demo';
const DAY = 24 * 60 * 60 * 1000;

interface Posting {
  title: string;
  company: string;
  location: string;
  workplaceType: 'remote' | 'hybrid' | 'onsite';
  salary?: [number, number];
  tags: string[];
}

const POSTINGS: Posting[] = [
  {
    title: 'Senior Software Engineer',
    company: 'Stripe',
    location: 'Seattle, WA',
    workplaceType: 'hybrid',
    salary: [190000, 260000],
    tags: ['fintech', 'backend'],
  },
  {
    title: 'Staff Software Engineer, Platform',
    company: 'Datadog',
    location: 'New York, NY',
    workplaceType: 'hybrid',
    salary: [220000, 300000],
    tags: ['observability', 'go'],
  },
  {
    title: 'Senior Backend Engineer',
    company: 'Shopify',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [170000, 230000],
    tags: ['ruby', 'ecommerce'],
  },
  {
    title: 'Principal Engineer, Infrastructure',
    company: 'Cloudflare',
    location: 'Austin, TX',
    workplaceType: 'hybrid',
    salary: [240000, 320000],
    tags: ['infrastructure', 'rust'],
  },
  {
    title: 'Software Engineer III',
    company: 'Google',
    location: 'Kirkland, WA',
    workplaceType: 'onsite',
    salary: [180000, 250000],
    tags: ['big tech'],
  },
  {
    title: 'Senior Full Stack Engineer',
    company: 'Notion',
    location: 'San Francisco, CA',
    workplaceType: 'hybrid',
    salary: [185000, 245000],
    tags: ['react', 'typescript'],
  },
  {
    title: 'Staff Engineer, Developer Experience',
    company: 'Vercel',
    location: 'Remote',
    workplaceType: 'remote',
    salary: [210000, 280000],
    tags: ['typescript', 'devtools'],
  },
  {
    title: 'Senior Software Engineer, Payments',
    company: 'Airbnb',
    location: 'Seattle, WA',
    workplaceType: 'remote',
    salary: [195000, 265000],
    tags: ['payments'],
  },
  {
    title: 'Lead Backend Engineer',
    company: 'Linear',
    location: 'Remote',
    workplaceType: 'remote',
    tags: ['startup', 'typescript'],
  },
  {
    title: 'Senior Engineer, Data Platform',
    company: 'Snowflake',
    location: 'Bellevue, WA',
    workplaceType: 'hybrid',
    salary: [200000, 270000],
    tags: ['data'],
  },
  {
    title: 'Software Engineer, Distributed Systems',
    company: 'Databricks',
    location: 'Mountain View, CA',
    workplaceType: 'hybrid',
    salary: [190000, 280000],
    tags: ['data', 'scala'],
  },
  {
    title: 'Senior Platform Engineer',
    company: 'GitLab',
    location: 'Remote',
    workplaceType: 'remote',
    salary: [160000, 220000],
    tags: ['devtools', 'kubernetes'],
  },
  {
    title: 'Staff Software Engineer',
    company: 'Figma',
    location: 'San Francisco, CA',
    workplaceType: 'hybrid',
    salary: [230000, 310000],
    tags: ['design tools', 'typescript'],
  },
  {
    title: 'Senior Software Engineer, API',
    company: 'Twilio',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [165000, 225000],
    tags: ['api'],
  },
  {
    title: 'Backend Engineer',
    company: 'Ramp',
    location: 'New York, NY',
    workplaceType: 'onsite',
    salary: [175000, 240000],
    tags: ['fintech', 'python'],
  },
  {
    title: 'Senior Software Engineer, Search',
    company: 'Spotify',
    location: 'New York, NY',
    workplaceType: 'hybrid',
    salary: [170000, 230000],
    tags: ['search', 'java'],
  },
  {
    title: 'Engineering Lead, Core Services',
    company: 'Discord',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [210000, 290000],
    tags: ['elixir', 'rust'],
  },
  {
    title: 'Senior Software Engineer',
    company: 'Atlassian',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [160000, 215000],
    tags: ['java', 'devtools'],
  },
  {
    title: 'Staff Engineer, Reliability',
    company: 'PagerDuty',
    location: 'Remote',
    workplaceType: 'remote',
    salary: [200000, 260000],
    tags: ['sre'],
  },
  {
    title: 'Senior Software Engineer, Growth',
    company: 'Duolingo',
    location: 'Pittsburgh, PA',
    workplaceType: 'onsite',
    salary: [165000, 220000],
    tags: ['growth'],
  },
  {
    title: 'Software Engineer, Machine Learning Platform',
    company: 'Anthropic',
    location: 'San Francisco, CA',
    workplaceType: 'hybrid',
    salary: [280000, 400000],
    tags: ['ai', 'python'],
  },
  {
    title: 'Senior Engineer, Checkout',
    company: 'Instacart',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [180000, 240000],
    tags: ['ecommerce'],
  },
  {
    title: 'Principal Software Engineer',
    company: 'HashiCorp',
    location: 'Remote',
    workplaceType: 'remote',
    salary: [230000, 300000],
    tags: ['go', 'infrastructure'],
  },
  {
    title: 'Senior Software Engineer, Mobile Backend',
    company: 'Strava',
    location: 'San Francisco, CA',
    workplaceType: 'hybrid',
    salary: [170000, 225000],
    tags: ['fitness'],
  },
  {
    title: 'Full Stack Engineer',
    company: 'Retool',
    location: 'San Francisco, CA',
    workplaceType: 'onsite',
    salary: [175000, 235000],
    tags: ['startup', 'react'],
  },
  {
    title: 'Senior Software Engineer, Identity',
    company: 'Okta',
    location: 'Bellevue, WA',
    workplaceType: 'hybrid',
    salary: [170000, 230000],
    tags: ['security'],
  },
  {
    title: 'Staff Software Engineer, Billing',
    company: 'Zendesk',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [200000, 260000],
    tags: ['billing'],
  },
  {
    title: 'Software Engineer, Backend',
    company: 'Plaid',
    location: 'Remote - US',
    workplaceType: 'remote',
    salary: [180000, 250000],
    tags: ['fintech', 'go'],
  },
  {
    title: 'Senior Engineer, Video Infrastructure',
    company: 'Mux',
    location: 'Remote',
    workplaceType: 'remote',
    tags: ['video', 'startup'],
  },
  {
    title: 'Senior Software Engineer',
    company: 'Expedia Group',
    location: 'Seattle, WA',
    workplaceType: 'hybrid',
    salary: [160000, 215000],
    tags: ['travel', 'java'],
  },
];

/** Each journey is the statuses a job went through, in order. */
const JOURNEYS: JobStatus[][] = [
  ['saved'],
  ['saved'],
  ['saved'],
  ['saved', 'applied'],
  ['saved', 'applied'],
  ['applied'],
  ['applied'],
  ['applied'],
  ['applied', 'ghosted'],
  ['applied', 'ghosted'],
  ['applied', 'ghosted'],
  ['applied', 'rejected'],
  ['applied', 'rejected'],
  ['applied', 'rejected'],
  ['applied', 'rejected'],
  ['applied', 'screening'],
  ['applied', 'screening'],
  ['applied', 'screening', 'rejected'],
  ['applied', 'screening', 'withdrawn'],
  ['applied', 'screening', 'interviewing'],
  ['applied', 'screening', 'interviewing'],
  ['applied', 'screening', 'interviewing', 'rejected'],
  ['applied', 'screening', 'interviewing', 'rejected'],
  ['applied', 'screening', 'interviewing', 'ghosted'],
  ['applied', 'screening', 'interviewing', 'offer'],
  ['applied', 'screening', 'interviewing', 'offer', 'withdrawn'],
  ['applied', 'screening', 'interviewing', 'offer', 'accepted'],
  ['saved', 'applied', 'screening', 'interviewing'],
  ['saved', 'withdrawn'],
  ['applied', 'interviewing', 'rejected'],
];

const INTERVIEWS = [
  'Recruiter screen',
  'Hiring manager call',
  'Technical interview',
  'System design',
  'Onsite loop',
  'Team fit',
];

/** A tiny deterministic PRNG so every run produces the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function findUser(db: Database, username?: string) {
  const rows = username
    ? await db.select().from(users).where(eq(users.username, username.toLowerCase()))
    : await db.select().from(users).where(eq(users.role, 'admin')).orderBy(users.id).limit(1);
  return rows[0];
}

async function remove(db: Database, userId: number): Promise<number> {
  const removed = await db
    .delete(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.source, DEMO_SOURCE)))
    .returning({ id: jobs.id });
  console.log(`Removed ${removed.length} demo job(s).`);
  return 0;
}

async function seed(db: Database, userId: number): Promise<number> {
  const next = random(42);
  const between = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const now = Date.now();
  let count = 0;

  for (const [index, posting] of POSTINGS.entries()) {
    const journey = JOURNEYS[index % JOURNEYS.length];
    // Spread the start dates over the last four months, more recent for shorter journeys.
    let at = now - between(7, 120) * DAY - between(0, 23) * 60 * 60 * 1000;
    const createdAt = new Date(at);
    const status = journey[journey.length - 1];
    const appliedIndex = journey.indexOf('applied');
    let appliedOn: string | undefined;
    const finished = !['saved', 'applied', 'screening', 'interviewing', 'offer'].includes(status);

    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: posting.title,
        company: posting.company,
        location: posting.location,
        workplaceType: posting.workplaceType,
        employmentType: 'full_time',
        status,
        interest: between(2, 5),
        salaryMin: posting.salary?.[0],
        salaryMax: posting.salary?.[1],
        salaryCurrency: posting.salary ? 'USD' : undefined,
        salaryPeriod: posting.salary ? 'year' : undefined,
        url: `https://jobs.example.com/${posting.company.toLowerCase().replace(/\W+/g, '-')}/${index + 1}`,
        source: DEMO_SOURCE,
        description: `${posting.company} is hiring a ${posting.title} in ${posting.location}.\n\nYou will design, build and operate services used by millions of people, work closely with product and design, and mentor other engineers. We are looking for 5+ years of experience shipping production software, strong fundamentals in distributed systems, and a habit of writing clear, well-tested code.`,
        notes:
          index % 3 === 0
            ? 'Referred by a former colleague. Follow up if no reply within two weeks.'
            : undefined,
        tags: [...posting.tags, 'demo'],
        postedOn: isoDate(new Date(at - between(1, 10) * DAY)),
        followUpOn:
          !finished && index % 4 === 1 ? isoDate(new Date(now + between(1, 10) * DAY)) : undefined,
        archived: finished && index % 5 === 0,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: jobs.id });

    await db.insert(jobEvents).values({
      jobId: job.id,
      type: 'created',
      toStatus: journey[0],
      occurredAt: createdAt,
    });
    if (appliedIndex === 0) appliedOn = isoDate(createdAt);

    for (let step = 1; step < journey.length; step++) {
      at += between(2, 14) * DAY;
      const occurredAt = new Date(Math.min(at, now - 60 * 60 * 1000));
      await db.insert(jobEvents).values({
        jobId: job.id,
        type: 'status_change',
        fromStatus: journey[step - 1],
        toStatus: journey[step],
        occurredAt,
      });
      if (step === appliedIndex) appliedOn = isoDate(occurredAt);
      if (journey[step] === 'interviewing') {
        for (let round = 0; round < between(1, 3); round++) {
          await db.insert(jobEvents).values({
            jobId: job.id,
            type: 'interview',
            title: INTERVIEWS[(index + round) % INTERVIEWS.length],
            body:
              round === 0
                ? 'Went well overall. Asked about scaling the ingestion pipeline.'
                : undefined,
            occurredAt: new Date(occurredAt.getTime() + (round + 1) * between(2, 5) * DAY),
          });
        }
      }
    }

    if (appliedOn)
      await db.update(jobs).set({ appliedOn, updatedAt: createdAt }).where(eq(jobs.id, job.id));
    count++;
  }

  console.log(`Added ${count} demo jobs. Run with --remove to delete them again.`);
  return 0;
}

async function main(args: string[]): Promise<number> {
  const removing = args.includes('--remove');
  const username = args.find((arg) => !arg.startsWith('--'));

  const file = path.join(loadConfig().dataDir, 'jobify.db');
  if (!existsSync(file)) {
    console.error(`No database found at ${file}. Start Jobify once and create your account first.`);
    return 1;
  }

  const { client, db } = await openDatabase(`file:${file}`);
  try {
    const user = await findUser(db, username);
    if (!user) {
      console.error(
        username
          ? `No user named "${username}".`
          : 'No users yet. Open Jobify in a browser to create the admin.',
      );
      return 1;
    }
    console.log(
      `${removing ? 'Removing demo jobs for' : 'Seeding demo jobs for'} ${user.username}…`,
    );
    return removing ? await remove(db, user.id) : await seed(db, user.id);
  } finally {
    client.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
