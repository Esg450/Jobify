import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  useAiSettings,
  useCheckSearchResults,
  useCurrentUser,
  useImportJob,
  useSearchJobs,
  useSearchSettings,
  useSuggestSearches,
} from '../api/hooks';
import {
  DEFAULT_SEARCH_SITES,
  SEARCH_JOB_TYPE_LABELS,
  SEARCH_JOB_TYPES,
  SEARCH_SITES,
  type JobDraft,
  type SearchJobType,
  type SearchQuery,
  type SearchResult,
  type SearchSettings as SearchSettingsValues,
  type SearchSite,
  type SearchSuggestion,
} from '../api/types';
import { Detail } from '../components/Detail';
import { Markdown } from '../components/Markdown';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, EmptyState, errorText } from '../components/ui/feedback';
import { Checkbox, Field, Input, Select } from '../components/ui/fields';
import { Modal } from '../components/ui/Modal';
import { PageSpinner } from '../components/ui/Spinner';
import { cn } from '../lib/cn';
import { formatDate, formatSalary } from '../lib/format';
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS } from '../lib/labels';
import { SEARCH_SORTS, sortResults, type SearchSort } from '../lib/searchSort';

const POSTED_WITHIN: { value: number | ''; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: 24, label: 'Last 24 hours' },
  { value: 72, label: 'Last 3 days' },
  { value: 24 * 7, label: 'Last week' },
  { value: 24 * 30, label: 'Last month' },
];

const RESULT_COUNTS = [10, 20, 50, 100];

/** The last search, kept for the session so coming back from Add job does not lose it. */
const STORAGE_KEY = 'jobify:search';
interface StoredSearch {
  query: SearchQuery;
  results: SearchResult[];
  warnings: string[];
  sort: SearchSort;
}

function loadStored(): StoredSearch | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSearch>;
    if (!parsed.query || !Array.isArray(parsed.results)) return null;
    return {
      query: parsed.query,
      results: parsed.results,
      warnings: parsed.warnings ?? [],
      sort: parsed.sort && parsed.sort in SEARCH_SORTS ? parsed.sort : 'relevance',
    };
  } catch {
    return null;
  }
}

function store(search: StoredSearch | null) {
  try {
    if (search) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(search));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; the results still show for this page view.
  }
}

export function SearchPage() {
  const user = useCurrentUser();
  const settings = useSearchSettings();

  if (!settings.data) return <PageSpinner />;
  if (!settings.data.configured) {
    return (
      <>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              Find jobs
              <BetaBadge />
            </span>
          }
        />
        <Card>
          <EmptyState
            icon={<Search className="size-6" />}
            title="Job board search is not set up"
            description={
              user.role === 'admin'
                ? 'Connect a JobSpy service in Settings to search Indeed, LinkedIn, Glassdoor and other boards from here.'
                : 'Ask an admin to connect a JobSpy service in Settings.'
            }
            action={
              user.role === 'admin' && (
                <ButtonLink to="/settings/search" icon={<Settings className="size-4" />}>
                  Open settings
                </ButtonLink>
              )
            }
          />
        </Card>
      </>
    );
  }
  return <SearchView settings={settings.data} />;
}

function BetaBadge() {
  return (
    <span
      title="Job board search is new. Results come from scraping the boards and can be incomplete or inaccurate."
      className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-950 dark:text-amber-300"
    >
      Beta
    </span>
  );
}

function SearchView({ settings }: { settings: SearchSettingsValues }) {
  const [stored] = useState(loadStored);
  const [found, setFound] = useState<StoredSearch | null>(stored);
  const search = useSearchJobs();
  const check = useCheckSearchResults();

  // Results kept from earlier may be out of date: the user may have saved some since.
  const { mutate: recheck } = check;
  useEffect(() => {
    if (!stored || stored.results.length === 0) return;
    recheck(
      stored.results.map(({ id, draft }) => ({
        id,
        title: draft.title ?? '',
        company: draft.company ?? '',
        url: draft.url ?? undefined,
      })),
      {
        onSuccess: (existing) =>
          setFound((current) => {
            if (!current) return current;
            const next = {
              ...current,
              results: current.results.map((result) =>
                result.id in existing ? { ...result, existing: existing[result.id] } : result,
              ),
            };
            store(next);
            return next;
          }),
      },
    );
  }, [stored, recheck]);

  /** Changes the shown search and keeps the stored copy in step. */
  const update = (change: (current: StoredSearch) => StoredSearch) =>
    setFound((current) => {
      if (!current) return current;
      const next = change(current);
      store(next);
      return next;
    });

  const run = (query: SearchQuery) =>
    search.mutate(query, {
      onSuccess: ({ results, warnings }) => {
        // Keep the sort the user picked for the previous search.
        const next = { query, results, warnings, sort: found?.sort ?? 'relevance' };
        setFound(next);
        store(next);
      },
    });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Find jobs
            <BetaBadge />
          </span>
        }
        description="Search the job boards and pull postings straight into your hunt. Results are scraped from the boards, so they can be incomplete or out of date: check the posting before you apply."
      />
      <div className="flex flex-col gap-4">
        <SearchForm
          initial={stored?.query}
          settings={settings}
          searching={search.isPending}
          onSearch={run}
        />

        {search.isError && <Alert>{errorText(search.error)}</Alert>}

        {search.isPending ? (
          <Card>
            <div
              className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400"
              role="status"
            >
              <PageSpinner />
              Searching the boards. This can take up to a minute.
            </div>
          </Card>
        ) : found ? (
          <Results
            results={found.results}
            warnings={found.warnings}
            sort={found.sort}
            onSortChange={(sort) => update((current) => ({ ...current, sort }))}
            onLoaded={(id, draft) =>
              update((current) => ({
                ...current,
                results: current.results.map((result) =>
                  result.id === id ? { ...result, draft, fullPosting: true } : result,
                ),
              }))
            }
          />
        ) : null}
      </div>
    </>
  );
}

function SearchForm({
  initial,
  settings,
  searching,
  onSearch,
}: {
  initial?: SearchQuery;
  settings: SearchSettingsValues;
  searching: boolean;
  onSearch: (query: SearchQuery) => void;
}) {
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [sites, setSites] = useState<SearchSite[]>(
    initial?.sites ?? (settings.defaultSites.length ? settings.defaultSites : DEFAULT_SEARCH_SITES),
  );
  const [remote, setRemote] = useState(initial?.remote ?? false);
  const [hoursOld, setHoursOld] = useState<number | ''>(initial?.hoursOld ?? '');
  const [jobType, setJobType] = useState<SearchJobType | ''>(initial?.jobType ?? '');
  const [limit, setLimit] = useState(initial?.limit ?? 20);
  const { data: ai } = useAiSettings();
  const suggest = useSuggestSearches();
  const suggestions = suggest.data?.suggestions ?? [];

  const toggleSite = (site: SearchSite, on: boolean) =>
    setSites((current) => (on ? [...current, site] : current.filter((s) => s !== site)));

  /** Puts a suggestion in the form. Nothing runs until the user presses Search. */
  const apply = (suggestion: SearchSuggestion) => {
    setTerms(suggestion.terms);
    if (suggestion.location) setLocation(suggestion.location);
    setRemote(suggestion.remote);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch({
      terms: terms.trim(),
      location: location.trim() || undefined,
      country: country.trim() || undefined,
      sites,
      remote: remote || undefined,
      hoursOld: hoursOld || undefined,
      jobType: jobType || undefined,
      limit,
    });
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto]">
          <Field label="Keywords">
            {(id) => (
              <Input
                id={id}
                required
                placeholder="e.g. platform engineer"
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
              />
            )}
          </Field>
          <Field label="Location">
            {(id) => (
              <Input
                id={id}
                placeholder="City, state or country"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            )}
          </Field>
          <Field label="Country" hint="For Indeed and Glassdoor">
            {(id) => (
              <Input
                id={id}
                placeholder={settings.country || 'USA'}
                className="md:w-28"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Boards
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.entries(SEARCH_SITES) as [SearchSite, string][]).map(([id, label]) => (
              <Checkbox
                key={id}
                label={label}
                checked={sites.includes(id)}
                onChange={(event) => toggleSite(id, event.target.checked)}
              />
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Posted">
            {(id) => (
              <Select
                id={id}
                value={hoursOld}
                onChange={(event) =>
                  setHoursOld(event.target.value ? Number(event.target.value) : '')
                }
              >
                {POSTED_WITHIN.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Job type">
            {(id) => (
              <Select
                id={id}
                value={jobType}
                onChange={(event) => setJobType(event.target.value as SearchJobType | '')}
              >
                <option value="">Any</option>
                {SEARCH_JOB_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SEARCH_JOB_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Results per board">
            {(id) => (
              <Select
                id={id}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              >
                {RESULT_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {suggest.isError && <Alert>{errorText(suggest.error)}</Alert>}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Try:</span>
            {suggestions.map((suggestion) => {
              const active = suggestion.terms === terms;
              return (
                <button
                  key={suggestion.terms}
                  type="button"
                  onClick={() => apply(suggestion)}
                  title={[
                    suggestion.location && `in ${suggestion.location}`,
                    suggestion.remote && 'remote',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  className={cn(
                    'rounded-full px-3 py-1 ring-1 transition-colors ring-inset',
                    active
                      ? 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900'
                      : 'bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800',
                  )}
                >
                  {suggestion.terms}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox
              label="Remote only"
              checked={remote}
              onChange={(event) => setRemote(event.target.checked)}
            />
            {ai?.configured && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Sparkles className="size-3.5" />}
                loading={suggest.isPending}
                title="Fill in the search from your profile (Settings, Account). You can change it before searching."
                onClick={() =>
                  suggest.mutate(undefined, {
                    onSuccess: ({ suggestions: [best] }) => best && apply(best),
                  })
                }
              >
                Suggest from my profile
              </Button>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Search className="size-4" />}
            loading={searching}
            disabled={sites.length === 0}
          >
            Search
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Results({
  results,
  warnings,
  sort,
  onSortChange,
  onLoaded,
}: {
  results: SearchResult[];
  warnings: string[];
  sort: SearchSort;
  onSortChange: (sort: SearchSort) => void;
  onLoaded: (id: string, draft: JobDraft) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (results.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Search className="size-6" />}
          title="Nothing found"
          description={
            warnings.length > 0
              ? warnings.join(' ')
              : 'Try broader keywords, another location, or more boards.'
          }
        />
      </Card>
    );
  }
  const sorted = sortResults(results, sort);
  const openIndex = sorted.findIndex((result) => result.id === openId);
  const saved = results.filter((result) => result.existing).length;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {results.length} {results.length === 1 ? 'posting' : 'postings'}
            {saved > 0 && `, ${saved} already in your jobs`}
          </span>
          <label className="flex items-center gap-2">
            Sort by
            <Select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SearchSort)}
              className="w-auto py-1"
            >
              {Object.entries(SEARCH_SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {warnings.map((warning) => (
          <p key={warning} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {warning}
          </p>
        ))}
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {sorted.map((result) => (
          <ResultRow key={result.id} result={result} onOpen={() => setOpenId(result.id)} />
        ))}
      </ul>
      {openIndex >= 0 && (
        <ResultDetails
          result={sorted[openIndex]}
          position={`${openIndex + 1} of ${sorted.length}`}
          onPrevious={openIndex > 0 ? () => setOpenId(sorted[openIndex - 1].id) : undefined}
          onNext={
            openIndex < sorted.length - 1 ? () => setOpenId(sorted[openIndex + 1].id) : undefined
          }
          onLoaded={onLoaded}
          onClose={() => setOpenId(null)}
        />
      )}
    </Card>
  );
}

/** Fields the site importer found replace JobSpy's; the rest fill in around them. */
function mergeDrafts(fromBoard: JobDraft, imported: JobDraft): JobDraft {
  const merged: JobDraft = { ...fromBoard };
  for (const [key, value] of Object.entries(imported) as [keyof JobDraft, unknown][]) {
    if (value !== undefined && value !== null && value !== '') {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function draftSalary(draft: JobDraft): string | null {
  return formatSalary({
    salaryMin: draft.salaryMin ?? null,
    salaryMax: draft.salaryMax ?? null,
    salaryCurrency: draft.salaryCurrency ?? null,
    salaryPeriod: draft.salaryPeriod ?? null,
  });
}

function ResultRow({ result, onOpen }: { result: SearchResult; onOpen: () => void }) {
  const { draft, existing } = result;
  const salary = draftSalary(draft);
  const details = [
    draft.location,
    draft.workplaceType && WORKPLACE_LABELS[draft.workplaceType],
    salary,
    draft.postedOn && `Posted ${formatDate(draft.postedOn)}`,
  ].filter(Boolean);

  return (
    <li
      // The whole row opens the details; its own links and buttons keep doing their job.
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('a, button')) onOpen();
      }}
      className={cn(
        'flex cursor-pointer flex-wrap items-start gap-3 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        existing && 'opacity-80',
      )}
    >
      <CompanyLogo src={result.logoUrl} company={draft.company} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="text-left font-medium hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
          >
            {draft.title}
          </button>
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {draft.source ?? result.site}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{draft.company}</p>
        {details.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{details.join(' · ')}</p>
        )}
        {existing && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Check className="size-3.5 text-emerald-600" aria-hidden />
            Already in your jobs
            {existing.hunt && existing.hunt.name ? ` (${existing.hunt.name})` : ''}:{' '}
            <Link to={`/jobs/${existing.id}`} className="hover:underline">
              {existing.title}
            </Link>
            <StatusBadge status={existing.status} />
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ResultActions result={result} />
      </div>
    </li>
  );
}

/** The posting link plus Import (or View job when the user already has it). */
function ResultActions({ result }: { result: SearchResult }) {
  const navigate = useNavigate();
  const importJob = useImportJob();
  const { draft, existing } = result;

  /**
   * Runs the posting through Jobify's own importers for a fuller description, then opens the
   * Add job page. If the board blocks the fetch, the board's own details are used as they are.
   * A posting already loaded in the details view goes straight through.
   */
  const review = () => {
    const open = (values: JobDraft) => navigate('/jobs/new', { state: { draft: values } });
    if (!draft.url || result.fullPosting) return open(draft);
    importJob.mutate(
      { url: draft.url },
      {
        onSuccess: ({ draft: imported }) => open(mergeDrafts(draft, imported)),
        onError: () => open(draft),
      },
    );
  };

  return (
    <>
      {draft.url && (
        <a
          href={draft.url}
          target="_blank"
          rel="noreferrer noopener"
          title="Open the posting"
          aria-label="Open the posting"
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
      {existing ? (
        <ButtonLink to={`/jobs/${existing.id}`} size="sm">
          View job
        </ButtonLink>
      ) : (
        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="size-3.5" />}
          loading={importJob.isPending}
          onClick={review}
        >
          Import
        </Button>
      )}
    </>
  );
}

/**
 * A preview of the posting, laid out like the job page: description, then a Details card.
 * Previous and next (also the arrow keys) step through the results in their sorted order.
 */
function ResultDetails({
  result,
  position,
  onPrevious,
  onNext,
  onLoaded,
  onClose,
}: {
  result: SearchResult;
  position: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onLoaded: (id: string, draft: JobDraft) => void;
  onClose: () => void;
}) {
  const { draft } = result;
  const salary = draftSalary(draft);
  const place = [draft.location, draft.workplaceType && WORKPLACE_LABELS[draft.workplaceType]]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrevious, onNext]);

  const step =
    'rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

  return (
    <Modal
      open
      title={draft.title ?? 'Job'}
      onClose={onClose}
      className="max-w-5xl"
      footer={<ResultActions result={result} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanyLogo key={result.id} src={result.logoUrl} company={draft.company} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4" aria-hidden />
              {draft.company}
            </span>
            {place && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {place}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            className={step}
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous result"
            title="Previous result (←)"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="tabular-nums">{position}</span>
          <button
            type="button"
            className={step}
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next result"
            title="Next result (→)"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Card className="max-h-[60vh] min-w-0 overflow-y-auto p-5 lg:col-span-2">
          {draft.description ? (
            <Markdown>{draft.description}</Markdown>
          ) : (
            <LoadFullPosting key={result.id} result={result} onLoaded={onLoaded} />
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Details" />
          <dl className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {salary && <Detail label="Salary">{salary}</Detail>}
            {draft.employmentType && (
              <Detail label="Employment">{EMPLOYMENT_LABELS[draft.employmentType]}</Detail>
            )}
            <Detail label="Source">{draft.source ?? result.site}</Detail>
            {draft.postedOn && <Detail label="Posted">{formatDate(draft.postedOn)}</Detail>}
          </dl>
        </Card>
      </div>
    </Modal>
  );
}

/**
 * Fetches the full posting through Jobify's importers for boards that send no description
 * (LinkedIn without "fetch descriptions", Google). Nothing is saved to the user's jobs.
 */
function LoadFullPosting({
  result,
  onLoaded,
}: {
  result: SearchResult;
  onLoaded: (id: string, draft: JobDraft) => void;
}) {
  const importJob = useImportJob();
  const { draft } = result;
  const url = draft.url;
  if (!url) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {draft.source ?? 'The board'} did not send a description or a link for this result.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {draft.source ?? 'The board'} did not send a description with this result.
      </p>
      <Button
        size="sm"
        loading={importJob.isPending}
        onClick={() =>
          importJob.mutate(
            { url },
            {
              onSuccess: ({ draft: imported }) => onLoaded(result.id, mergeDrafts(draft, imported)),
            },
          )
        }
      >
        Load full posting
      </Button>
      {importJob.isError && <Alert>Could not load the posting: {errorText(importJob.error)}</Alert>}
    </div>
  );
}

/** The board's company logo, or the company's initial when there is none or it fails to load. */
function CompanyLogo({ src, company }: { src?: string; company?: string }) {
  const [failed, setFailed] = useState<boolean>(false);
  const box =
    'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700';
  if (src && !failed) {
    return (
      <div className={box}>
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        box,
        'bg-zinc-100 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
      )}
      aria-hidden
    >
      {company?.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}
