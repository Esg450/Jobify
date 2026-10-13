import { useState, type FormEvent } from 'react';
import {
  useCurrentUser,
  useSearchSettings,
  useTestSearch,
  useUpdateSearchSettings,
} from '../../api/hooks';
import {
  SEARCH_SITES,
  type SearchSettings as SearchSettingsValues,
  type SearchSite,
} from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Checkbox, Field, Input, Textarea } from '../../components/ui/fields';
import { PageSpinner } from '../../components/ui/Spinner';

const SIDECAR_DOCS = 'https://github.com/esg450/jobify#job-search';

export function SearchSettings() {
  const user = useCurrentUser();
  const settings = useSearchSettings();

  if (!settings.data) return <PageSpinner />;
  if (user.role !== 'admin') {
    return (
      <Card>
        <CardHeader title="Job search" />
        <p className="p-5 text-sm text-zinc-600 dark:text-zinc-300">
          {settings.data.configured
            ? 'Job board search is on. Use the Find jobs page to search Indeed, LinkedIn and other boards.'
            : 'Job board search is turned off. Ask an admin to connect a JobSpy service.'}
        </p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <SearchSettingsCard settings={settings.data} />
      {settings.data.configured && <SearchDefaultsCard settings={settings.data} />}
    </div>
  );
}

function SearchSettingsCard({ settings }: { settings: SearchSettingsValues }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const update = useUpdateSearchSettings();
  const test = useTestSearch();

  // An empty key field keeps the saved key, for both testing and saving.
  const values = { baseUrl, ...(apiKey && { apiKey }) };
  const canTest = baseUrl.trim() !== '' && !update.isPending;

  const save = (event: FormEvent) => {
    event.preventDefault();
    test.reset();
    update.mutate({ enabled, ...values }, { onSuccess: () => setApiKey('') });
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Job search
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-950 dark:text-amber-300">
              Beta
            </span>
          </span>
        }
        description={
          <>
            Search Indeed, LinkedIn, Glassdoor and other boards from inside Jobify through a{' '}
            <a
              href={SIDECAR_DOCS}
              target="_blank"
              rel="noreferrer noopener"
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              JobSpy service
            </a>{' '}
            running on your server. Shared by everyone on this Jobify; the API key is stored on your
            server and never sent back to the browser. This is a beta feature: results are scraped
            from the boards and can be incomplete or inaccurate.
          </>
        }
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <Checkbox
          label="Enable job board search"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />

        <Field
          label="JobSpy service URL"
          hint="Where the jobify-jobspy container is reachable from the Jobify server, e.g. http://192.168.1.10:8000"
        >
          {(id) => (
            <Input
              id={id}
              type="url"
              value={baseUrl}
              required={enabled}
              placeholder="http://jobspy:8000"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="API key"
          hint={
            settings.hasApiKey
              ? 'A key is saved. Leave blank to keep it.'
              : 'The value of API_KEYS on the JobSpy container. Leave blank if it runs without one.'
          }
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={settings.hasApiKey ? '••••••••••••' : ''}
              onChange={(event) => setApiKey(event.target.value)}
            />
          )}
        </Field>

        {update.isError && <Alert>Not saved. {errorText(update.error)}</Alert>}
        {update.isSuccess && !test.isSuccess && (
          <Alert tone="success">
            {update.data.enabled
              ? 'Saved. The service answered, and Find jobs is now in the sidebar for everyone.'
              : 'Saved. Job board search is off.'}
          </Alert>
        )}
        {test.isError && <Alert>{errorText(test.error)}</Alert>}
        {test.isSuccess && (
          <Alert tone="success">
            Connected{test.data.version ? ` to JobSpy ${test.data.version}` : ''}.
            {test.data.sites.length > 0 && (
              <span className="mt-1 block text-xs opacity-80">
                Boards: {test.data.sites.map((site) => siteName(site)).join(', ')}
              </span>
            )}
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">
            {enabled
              ? 'Saving checks the connection first.'
              : 'Turn it on to make Find jobs available.'}
          </p>
          <Button
            disabled={!canTest}
            loading={test.isPending}
            title={canTest ? undefined : 'Enter the service URL first'}
            onClick={() => {
              update.reset();
              test.mutate(values);
            }}
          >
            Test connection
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={update.isPending}
            disabled={test.isPending}
          >
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** How every search runs. Only shown once the service is connected. */
function SearchDefaultsCard({ settings }: { settings: SearchSettingsValues }) {
  const [sites, setSites] = useState<SearchSite[]>(settings.defaultSites);
  const [country, setCountry] = useState(settings.country);
  const [distance, setDistance] = useState(settings.distance?.toString() ?? '');
  const [fetchDescriptions, setFetchDescriptions] = useState(settings.fetchDescriptions);
  const [annualSalaries, setAnnualSalaries] = useState(settings.annualSalaries);
  const [proxies, setProxies] = useState('');
  const [clearProxies, setClearProxies] = useState(false);
  const update = useUpdateSearchSettings();

  const toggleSite = (site: SearchSite, on: boolean) =>
    setSites((current) => (on ? [...current, site] : current.filter((s) => s !== site)));

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        enabled: settings.enabled,
        defaultSites: sites,
        country,
        distance: distance === '' ? null : Number(distance),
        fetchDescriptions,
        annualSalaries,
        // Blank keeps the saved proxies unless the admin asked to remove them.
        ...(clearProxies ? { proxies: '' } : proxies.trim() && { proxies }),
      },
      {
        onSuccess: () => {
          setProxies('');
          setClearProxies(false);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title="Search defaults"
        description="How searches run for everyone. People can still choose boards and a country for each search."
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Boards selected by default
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Country"
            hint="For Indeed and Glassdoor, which search one country at a time: USA, UK, Canada, Germany, …"
          >
            {(id) => (
              <Input
                id={id}
                placeholder="USA"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            )}
          </Field>
          <Field
            label="Search radius (miles)"
            hint="Around the location entered for a search. Blank uses JobSpy's default of 50."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={500}
                placeholder="50"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Checkbox
            label="Fetch LinkedIn descriptions during the search"
            checked={fetchDescriptions}
            onChange={(event) => setFetchDescriptions(event.target.checked)}
          />
          <p className="-mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
            Off, LinkedIn results show without a description and Import fetches it for the one you
            pick. On, every result is fetched during the search, which is slower and gets rate
            limited sooner.
          </p>
          <Checkbox
            label="Show hourly, weekly and monthly pay as yearly figures"
            checked={annualSalaries}
            onChange={(event) => setAnnualSalaries(event.target.checked)}
          />
        </div>

        <Field
          label="Proxies"
          hint={
            settings.proxyCount > 0
              ? `${settings.proxyCount} ${settings.proxyCount === 1 ? 'proxy is' : 'proxies are'} saved and never shown again. Leave blank to keep them.`
              : 'Optional. Job boards rate limit addresses that search often; proxies spread searches out. One per line, as user:pass@host:port or host:port.'
          }
        >
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                settings.proxyCount > 0 ? '••••••••' : 'user:pass@proxy.example.com:8080'
              }
              value={proxies}
              disabled={clearProxies}
              onChange={(event) => setProxies(event.target.value)}
            />
          )}
        </Field>
        {settings.proxyCount > 0 && (
          <Checkbox
            label="Remove the saved proxies"
            checked={clearProxies}
            onChange={(event) => setClearProxies(event.target.checked)}
          />
        )}

        {update.isError && <Alert>Not saved. {errorText(update.error)}</Alert>}
        {update.isSuccess && <Alert tone="success">Saved.</Alert>}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save defaults
          </Button>
        </div>
      </form>
    </Card>
  );
}

function siteName(site: string): string {
  return (SEARCH_SITES as Record<string, string>)[site] ?? site;
}
